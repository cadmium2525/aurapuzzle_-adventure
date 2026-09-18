/* ショップ:通貨の違う商品、1日の購入上限(ドリンク・小袋)、買い切り(キャラ)。
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

    /* --- オーブ小袋: コイン→ダイヤの蛇口が1日1個で止まること --- */
    const pouch = await page.evaluate(async () => {
      const g = await import('/src/js/data/gamedata.js');
      return g.SHOP_ITEMS.find(i => i.type === 'orb');
    });
    console.log('オーブ小袋:', JSON.stringify(pouch));
    assert.ok(pouch.dailyLimit > 0, '上限がないとコイン収入がそのままダイヤに化ける');

    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      s.coin = 999999; s.orb = 0; s.shopLog = { date: '', counts: {} };
      localStorage.setItem('acb_state', JSON.stringify(s));
    });
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('shop'); });

    const prow = page.locator('.shop-row').filter({ hasText: 'オーブ小袋' });
    const preadFn = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return { coin: s.coin, orb: s.orb, bought: (s.shopLog && s.shopLog.counts['sh_orb']) || 0 };
    });
    const p0 = await preadFn();
    for (let i = 0; i < pouch.dailyLimit; i++) {
      await prow.locator('button').click();
      await page.waitForTimeout(220);
    }
    const p1 = await preadFn();
    console.log(`上限まで: コイン ${p0.coin}→${p1.coin} / オーブ ${p0.orb}→${p1.orb}`,
      `/ ${(await prow.locator('button').textContent()).trim()}`);
    assert.equal(p1.orb, pouch.amount * pouch.dailyLimit, '買えた数が上限と合わない');
    assert.equal(p1.coin, p0.coin - pouch.price * pouch.dailyLimit);
    assert.equal(await prow.locator('button').getAttribute('disabled'), '', 'コインが余っていても上限で止まること');
    await prow.locator('button').click({ force: true });
    await page.waitForTimeout(200);
    assert.deepEqual(await preadFn(), p1, 'コインさえあれば上限を超えて買えてしまった');

    // ダイヤ→スタミナ→コイン→ダイヤ の輪が赤字で閉じていること。
    // 1日に得られるダイヤは上限で頭打ちなので、ドリンクを買い切る値段より安いはず。
    const perDay = pouch.amount * pouch.dailyLimit;
    const drinkCost = drink.price * drink.dailyLimit;
    console.log(`1日に替えられるダイヤ: ${perDay} / ドリンクを買い切る値段: ${drinkCost} ダイヤ`);
    assert.ok(perDay < drinkCost,
      `コインへ回しても ${perDay} ダイヤしか戻らないのに ${drinkCost} ダイヤ払う形でないと輪が閉じない`);

    /* --- キャラは買い切り: 送還して所持数が0に戻っても買い直せないこと --- */
    const chr = await page.evaluate(async () => {
      const g = await import('/src/js/data/gamedata.js');
      return g.SHOP_ITEMS.find(i => i.type === 'character');
    });
    console.log('ショップのキャラ:', JSON.stringify(chr));
    assert.ok(chr.totalLimit > 0, '買い切りでないと「買って送還」で素材が無限に増える');

    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      s.coin = 999999; s.shopLog = { date: '', counts: {} }; s.shopTotal = {};
      localStorage.setItem('acb_state', JSON.stringify(s));
    });
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('shop'); });

    const crow = page.locator('.shop-row').filter({ hasText: '買い切り' }).first();
    await crow.locator('button').click();
    await page.waitForTimeout(250);
    // 所持数はキャラID、通算購入数は商品IDで引く(キーが違う)
    const owned = await page.evaluate(([charId, itemId]) => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return { n: (s.characters[charId] || {}).n || 0, total: (s.shopTotal || {})[itemId] || 0 };
    }, [chr.charId, chr.id]);
    console.log(`購入後: 所持 ${owned.n} 体 / 通算 ${owned.total} 回`);
    assert.equal(owned.n, 1);
    assert.equal(owned.total, 1);

    const crow2 = page.locator('.shop-row').filter({ hasText: '購入済み' }).first();
    assert.equal(await crow2.count(), 1, '買い切りの表示になっていない');

    // 送還して所持数を0にしても、買い直せてはいけない
    await page.evaluate(async id => {
      const st = await import('/src/js/core/state.js');
      st.dismissCharacter(id, 99);
      (await import('/src/js/screens/shop.js')).renderShop();
    }, chr.charId);
    await page.waitForTimeout(200);
    const afterDismiss = await page.evaluate(id => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return { n: (s.characters[id] || {}).n || 0, coin: s.coin };
    }, chr.charId);
    console.log(`送還後: 所持 ${afterDismiss.n} 体 / コイン ${afterDismiss.coin}`);
    assert.equal(afterDismiss.n, 0, '送還できていない(前提が崩れている)');
    const stillBought = page.locator('.shop-row').filter({ hasText: '購入済み' }).first();
    assert.equal(await stillBought.locator('button').getAttribute('disabled'), '',
      '送還して所持数が0に戻ると買い直せてしまう');
    await stillBought.locator('button').click({ force: true });
    await page.waitForTimeout(200);
    const reBuy = await page.evaluate(id => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return (s.characters[id] || {}).n || 0;
    }, chr.charId);
    assert.equal(reBuy, 0, '買い切りなのに2体目が買えてしまった');

    // 日付が変わっても買い切りは戻らない
    await page.evaluate(async () => {
      const { state } = await import('/src/js/core/state.js');
      state.shopLog = { date: '2000-01-01', counts: {} };
      (await import('/src/js/screens/shop.js')).renderShop();
    });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.shop-row').filter({ hasText: '購入済み' }).count(), 1,
      '日付が変わると買い切りが戻ってしまう');
    console.log('日付が変わっても: 購入済みのまま');

    assert.deepEqual(errors, []);
    console.log('PASS: ドリンクは1日3本、小袋は1日1個、キャラは買い切り。コイン→ダイヤの蛇口は上限で止まる');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
