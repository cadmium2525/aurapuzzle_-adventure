/* フレンド登録が黙って失敗しないこと、片側だけの登録をやり直せること、
   クラウドが空振りしても手元の一覧を消さないこと。
   Firebase はメモリ上の偽物に差し替えて動かす。
   node scripts/check-friends.cjs                                    */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://l').pathname);
  try {
    const f = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
    if (!f.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    res.end(await fs.readFile(f));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const fake = await fs.readFile(path.join(__dirname, 'fake-firebase.js'), 'utf8');
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    // Firebase をメモリ上の偽物に差し替える(本番のプロジェクトには触らない)
    await page.route('**/core/firebase.js', route => route.fulfill({ contentType: 'text/javascript', body: fake }));
    // フレンド機能を触れるところまで出す
    await page.route('**/core/friends.js', async route => {
      const r = await route.fetch();
      await route.fulfill({ response: r, body: (await r.text()) +
        '\nwindow.friendTest = { initCloud, refreshFriendsList, addFriendByCode, state };' });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => {
      window.__fb.seed('friendCodes/AC-FRIEND01', { uid: 'U1' });
      window.__fb.seed('users/U1', { name: 'アルファ', icon: '🙂', friendCode: 'AC-FRIEND01' });
      window.__fb.seed('friendCodes/AC-FRIEND02', { uid: 'U2' });
      window.__fb.seed('friendCodes/AC-FRIEND03', { uid: 'U3' });
      window.__fb.seed('users/U3', { name: 'ガンマ', icon: '🙂', friendCode: 'AC-FRIEND03' });
      window.__fb.seed('users/U2', { name: 'ベータ', icon: '🙂', friendCode: 'AC-FRIEND02' });
      await friendTest.initCloud();
    });

    // --- 1. ふつうに登録できる ---
    let res = await page.evaluate(() => friendTest.addFriendByCode('AC-FRIEND01'));
    assert.equal(res.ok, true, res.message);
    assert.equal(await page.evaluate(() => friendTest.state.profile.friends.length), 1);
    assert.ok(await page.evaluate(() => !!window.__fb.store.get('users/U1/friends/ME')),
      '相手の一覧に自分が入っていない');
    console.log('登録:', res.message);

    // --- 2. 相手側へ書けなくても、登録は成立して理由が返る ---
    await page.evaluate(() => window.__fb.failSet('users/U2/friends'));
    res = await page.evaluate(() => friendTest.addFriendByCode('AC-FRIEND02'));
    assert.equal(res.ok, true, '相手側が書けないだけで登録ごと失敗している: ' + res.message);
    assert.match(res.message, /やり直/, '片側だけになったことを知らせていない');
    const mine = await page.evaluate(() => window.__fb.store.get('users/ME/friends/U2'));
    assert.equal(mine.linkPending, true, 'やり直すための印が残っていない');
    assert.equal(await page.evaluate(() => friendTest.state.profile.friends.length), 2,
      '自分の一覧に入っていない(利用者には「登録したのに消えた」に見える)');
    console.log('片側だけ:', res.message);

    // --- 3. 次の更新でやり直して両側そろう ---
    await page.evaluate(() => window.__fb.clearFail());
    await page.evaluate(() => friendTest.refreshFriendsList());
    assert.ok(await page.evaluate(() => !!window.__fb.store.get('users/U2/friends/ME')),
      'やり直しで相手の一覧に入っていない');
    assert.equal(await page.evaluate(() => window.__fb.store.get('users/ME/friends/U2').linkPending),
      undefined, 'やり直したのに印が残っている');
    console.log('やり直し: 両側そろった');

    // --- 4. 通信が死んでいるときは、黙らずに理由を返す ---
    await page.evaluate(() => window.__fb.failGet('friendCodes'));
    res = await page.evaluate(() => friendTest.addFriendByCode('AC-FRIEND03'));
    assert.equal(res.ok, false, '通信が死んでいるのに成功を返している');
    assert.match(res.message, /通信/, '通信の失敗が利用者に伝わらない: ' + res.message);
    console.log('通信断:', res.message);
    await page.evaluate(() => window.__fb.clearFail());

    // --- 5. クラウドが空振りしても手元の一覧を消さない ---
    //     (匿名ログインが作り直されて別の uid を見てしまう事故への保険)
    const before = await page.evaluate(() => friendTest.state.profile.friends.length);
    await page.evaluate(() => {
      [...window.__fb.store.keys()].filter(k => k.startsWith('users/ME/friends/'))
        .forEach(k => window.__fb.store.delete(k));
      return friendTest.refreshFriendsList();
    });
    assert.equal(await page.evaluate(() => friendTest.state.profile.friends.length), before,
      'クラウドが0件を返しただけでフレンドが全員消えた');
    console.log('空振りの保険: %d人を保持', before);

    assert.deepEqual(errors, [], '画面側で例外が出ている');
    console.log('PASS: 登録の失敗が見える / 片側だけでも成立 / やり直し / 空振りで消えない');
  } finally { await browser.close(); server.close(); }
})();
