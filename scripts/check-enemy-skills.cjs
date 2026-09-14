const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const types = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.webp':'image/webp' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Test-only access to private controller state, never shipped in app source.
    await page.route('**/battle/battle.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.battleTest = { snapshot: () => structuredClone({run,bstate,board}), resolveTurn, setBoard: b => {board=b;}, dragTimeMs };' });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    await page.evaluate(async () => {
      const { STAGES } = await import('/src/js/data/gamedata.js');
      const { startDungeonRun } = await import('/src/js/battle/battle.js');
      const stage = structuredClone(STAGES[0]);
      stage.floors[0].hp = 100000;
      stage.floors[0].interval = 1;
      stage.floors[0].enemySkills = {
        preemptive: { effects: [{type:'bind',count:3,turns:1},{type:'timeFixed',seconds:2,turns:1},{type:'auraBind',aura:0,turns:1}] },
        actions: [{ effects: [{type:'skillDelay',count:3,turns:3}] }]
      };
      startDungeonRun(stage, false, null);
    });
    assert.equal(await page.evaluate(() => battleTest.snapshot().bstate), 'resolving');
    await page.waitForFunction(() => battleTest.snapshot().bstate === 'idle');
    assert.equal(await page.locator('#partyRow .bound').count(), 3);
    assert.equal(await page.evaluate(() => battleTest.dragTimeMs()), 2000);
    const before = await page.evaluate(() => battleTest.snapshot());
    await page.evaluate(async () => {
      const board = Array.from({length:8},()=>Array(7).fill(-1));
      for(let c=0;c<4;c++) { board[7][c]=0; board[6][c]=1; board[5][c]=3; }
      battleTest.setBoard(board);
      await battleTest.resolveTurn();
    });
    const after = await page.evaluate(() => battleTest.snapshot());
    assert.equal(after.run.enemyHP, before.run.enemyHP);
    assert.equal(after.run.stats.totalHeal, 0);
    assert.equal(after.run.stats.maxChain, 1);
    assert.deepEqual(after.board[7].slice(0,4), [0,0,0,0]);
    assert.deepEqual(after.run.cooldowns, before.run.cooldowns.map(n=>Math.max(0,n-1)+3));
    assert.equal(await page.locator('#partyRow .bound').count(), 0);
    assert.ok(await page.evaluate(() => battleTest.dragTimeMs()) > 2000);
    await page.evaluate(async () => {
      const { STAGES } = await import('/src/js/data/gamedata.js');
      const { startDungeonRun } = await import('/src/js/battle/battle.js');
      const stage = structuredClone(STAGES[0]);
      stage.floors = stage.floors.slice(0,2);
      stage.floors[0].hp = 1;
      stage.floors[1].atk = 999999;
      stage.floors[1].enemySkills = { preemptive: { attack: true } };
      startDungeonRun(stage, false, null);
      const board = Array.from({length:8},()=>Array(7).fill(-1));
      for(let c=0;c<4;c++) board[7][c]=0;
      battleTest.setBoard(board);
      await battleTest.resolveTurn();
    });
    assert.equal(await page.locator('#resultTitle').innerText(), 'DEFEAT');
    assert.equal(await page.evaluate(() => battleTest.snapshot().run), null);
    assert.deepEqual(errors, []);
    console.log('PASS: preemptive input lock, bind attack/heal suppression, aura bind, fixed time expiry, full skill delay, status UI, next-floor preemptive defeat');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
