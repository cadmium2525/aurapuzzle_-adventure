/* ショップ:通貨の違う商品と、1日に買える数の上限(スタミナドリンク)。
   node scripts/check-shop.cjs                                       */
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
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });

    const drink = await page.evaluate(async () => {
      const g = await import('/src/js/data/gamedata.js');
      return g.SHOP_ITEMS.find(i => i.type === 'stamina');
    });
    console.log('スタミナドリンク:', JSON.stringify(drink));
    assert.ok(drink, 'スタミナドリンクがない');
    assert.equal(drink.currency, 'orb', 'コイン建てだとコインとスタミナの無限増殖ができてしまう');
    assert.ok(drink.dailyLimit > 0, '1日の上限がない');

    // スタミナを減らし、オーブは十分に持たせる
    const before = await page.evaluate(n => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      s.stamina = 10; s.orb = 100; s.shopLog = { date: '', counts: {} };
      localStorage.setItem('acb_state', JSON.stringify(s));
      return n;
    }, 0);
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('shop'); });

    const row = page.locator('.shop-row').filter({ hasText: 'スタミナドリンク' });
    assert.equal(await row.count(), 1, 'ショップに出ていない');
    console.log('表示:', (await row.textContent()).replace(/\s+/g, ' ').trim());
    assert.ok(/本日あと *\d+ *\/ *\d+/.test(await row.textContent()), '残り本数が出ていない');

    const read = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return { stamina: s.stamina, orb: s.orb, bought: (s.shopLog && s.shopLog.counts['sh_stamina']) || 0 };
    });
    const start = await read();
    await row.locator('button').click();
    await page.waitForTimeout(250);
    const after1 = await read();
    console.log(`1本目: スタミナ ${start.stamina}→${after1.stamina} / オーブ ${start.orb}→${after1.orb}`);
    assert.equal(after1.stamina, start.stamina + drink.amount, 'スタミナが増えていない');
    assert.equal(after1.orb, start.orb - drink.price, 'オーブが減っていない');
    assert.equal(after1.bought, 1);

    // 上限まで買うと売り切れる
    for (let i = 1; i < drink.dailyLimit; i++) {
      await row.locator('button').click();
      await page.waitForTimeout(200);
    }
    const maxed = await read();
    assert.equal(maxed.bought, drink.dailyLimit);
    assert.equal(await row.locator('button').getAttribute('disabled'), '', '上限に達しても押せてしまう');
    console.log('上限まで:', (await row.locator('button').textContent()).trim(),
      `/ スタミナ ${maxed.stamina} / オーブ ${maxed.orb}`);
    await row.locator('button').click({ force: true });
    await page.waitForTimeout(200);
    assert.deepEqual(await read(), maxed, '上限を超えて買えてしまった');

    // 日付が変われば戻る(記録は読み込み済みの state 側を直接ずらす)
    await page.evaluate(async () => {
      const { state } = await import('/src/js/core/state.js');
      state.shopLog = { date: '2000-01-01', counts: { sh_stamina: 99 } };
      (await import('/src/js/screens/shop.js')).renderShop();
    });
    await page.waitForTimeout(200);
    assert.equal(await row.locator('button').getAttribute('disabled'), null, '日付が変わっても戻らない');
    console.log('日付が変わったあと:', (await row.textContent()).replace(/\s+/g, ' ').trim());

    // オーブが足りなければ買えない
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      s.orb = 0; s.shopLog = { date: '', counts: {} };
      localStorage.setItem('acb_state', JSON.stringify(s));
    });
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('shop'); });
    const poor = await read();
    await row.locator('button').click();
    await page.waitForTimeout(250);
    assert.deepEqual(await read(), poor, 'オーブ0でも買えてしまった');
    console.log('オーブ0のとき:', (await page.locator('#toast').textContent()).trim());

    assert.deepEqual(errors, []);
    console.log('PASS: スタミナドリンクはオーブ建て、1日の上限あり、日付で戻る');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
