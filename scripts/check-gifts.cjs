/* コードに埋め込んだ配布(BUILTIN_GIFTS)が、
   すでに遊んでいる人へ1回だけ届くかを見る。
   配布を足したら流すこと。node scripts/check-gifts.cjs      */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url,'http://l').pathname);
  try {
    const file = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);

    // 既存プレイヤー: 過去の配布は受け取り済み、ログインボーナスも今日の分は済み
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      const today = new Date();
      const d = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      s.giftLog = { gift_dark_debut: d, gift_x_launch: d };
      s.login = { date: d, streak: 3 };
      s.gifts = [];
      s.orb = 15;
      localStorage.setItem('acb_state', JSON.stringify(s));
    });
    await page.goto(url);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.waitForTimeout(800);

    // 受け取り済みにしていない配布(=一番新しいもの)だけが入るはず
    const expected = await page.evaluate(async () => {
      const { BUILTIN_GIFTS } = await import('/src/js/data/gamedata.js');
      return BUILTIN_GIFTS.filter(g => !['gift_dark_debut', 'gift_x_launch'].includes(g.key));
    });
    const box = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).gifts);
    console.log('箱の中身:', box.map(g => `${g.title} / 💎${g.orb || 0}`));
    assert.equal(box.length, expected.length, '配布の件数が合わない');
    expected.forEach((g, i) => {
      assert.equal(box[i].title, g.title);
      assert.equal(box[i].orb || 0, g.orb || 0);
    });
    const orbTotal = expected.reduce((n, g) => n + (g.orb || 0), 0);

    console.log('バッジ:', await page.locator('#homePresentBadge').textContent());
    await page.locator('#homePresentBtn').click();
    await page.waitForTimeout(400);
    console.log('表示:', (await page.locator('#presentList').textContent()).replace(/\s+/g,' ').trim().slice(0,80));

    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).orb);
    await page.locator('#presentClaimAllBtn').click();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).orb);
    console.log(`オーブ: ${before} → ${after}`);
    assert.equal(after, before + orbTotal, `オーブが${orbTotal}増えていない`);
    assert.equal(await page.locator('#curOrb').textContent(), String(after), 'トップバーに反映されていない');

    // 2回目の起動で重複して配られないこと
    await page.goto(url);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.waitForTimeout(600);
    const again = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')));
    assert.equal(again.gifts.length, 0, '再配布されている');
    assert.equal(again.orb, after, 'オーブが二重に増えている');
    console.log('再起動後: 重複なし / オーブ', again.orb);
    assert.deepEqual(errs, []);
    console.log(`PASS: 既存プレイヤーに未受け取りの配布(💎${orbTotal})が1回だけ届く`);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e.message || e); process.exit(1); });
