/* 古いセーブが現行フォーマットへ移行できるかを見る。
   セーブのバージョンを上げたら、その形をここに足して流すこと。
   node scripts/check-save-migration.cjs                          */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}/`;

    for (const old of [
      // v8 (1つの編成) / v5 (所持数が数値) / v4 (旧モンスターID)
      { label: 'v8', save: { version: 8, rank: 5, coin: 1234, stamina: 40, characters: {
          fl_rito:{n:2,star:1,lv:9,xp:3,awa:1}, aq_mio:{n:1,star:4,lv:12,xp:0,awa:0}, wd_yggd:{n:3,star:4,lv:5,xp:0,awa:2} },
          team: ['aq_mio','wd_yggd','fl_rito'], materials:{mt_c0:7}, progress:{1:{normal:true}} } },
      { label: 'v5', save: { version: 5, rank: 3, characters: { fl_rito: 4, aq_mio: 1 }, team: ['fl_rito','aq_mio'] } },
      { label: 'v4', save: { version: 4, rank: 2, monsters: { c0_3: 2, c1_4: 1 }, team: ['c0_3'] } }
    ]) {
      await page.goto(url);
      await page.evaluate(s => localStorage.setItem('acb_state', JSON.stringify(s)), old.save);
      await page.goto(url);
      await page.locator('#titleScreen.ready').click({ timeout: 30000 });
      const s = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')));
      assert.equal(s.version, 9, old.label + ': version');
      assert.equal(s.teams.length, 5, old.label + ': プリセットが5つない');
      s.teams.forEach(t => assert.equal(t.length, 3, old.label + ': 枠が3つない'));
      assert.ok(s.teams[0].some(Boolean), old.label + ': 1番目のプリセットが空');
      assert.equal(s.team, undefined, old.label + ': 旧 team が残っている');
      Object.values(s.characters).forEach(e => assert.equal(typeof e.at, 'number', old.label + ': at がない'));
      const shown = await page.evaluate(() => document.querySelectorAll('#homePartyArt .hp-slot').length);
      console.log(`${old.label}: teams[0]=${JSON.stringify(s.teams[0])} rank=${s.rank} ホーム表示=${shown}人`);
      assert.ok(shown > 0, old.label + ': ホームに誰も出ていない');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: v4/v5/v8 のセーブが v9 へ移行し、編成とホーム表示が保たれる');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e.message || e); process.exit(1); });
