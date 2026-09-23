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
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.battleTest = { snapshot: () => structuredClone({run,bstate,board}), resolveTurn, setBoard: b => {board=b;}, setCooldowns: cds => {run.cooldowns=cds;updateSkillUI();}, useTestSkill: sk => {run.party.members[0].skill=sk;run.cooldowns[0]=0;return applySkill(0);}, dragTimeMs };' });
    });
    await page.route('**/battle/renderer.js',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text())+'\nwindow.conversionTest=()=>conversion?structuredClone(conversion):null;'});
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
        passives: [{type:'buildUp'},{type:'resolve',threshold:30},{type:'auraAbsorb',aura:0,turns:2},{type:'comboGuard',chains:3},{type:'shapeGuard',shape:'L'}],
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
    const chainOverlays = await page.evaluate(async () => {
      const { drawBoard, CELL } = await import('/src/js/battle/renderer.js');
      const context = document.getElementById('board').getContext('2d');
      const original = context.drawImage;
      const testBoard = Array.from({ length: 8 }, () => Array(7).fill(-1));
      testBoard[0][0] = 0;
      testBoard[0][1] = 3;
      const count = (auraBinds, dragging = false) => {
        let overlays = 0;
        context.drawImage = function (image, ...args) {
          if (image instanceof HTMLCanvasElement) overlays++;
          return original.call(this, image, ...args);
        };
        try {
          drawBoard({ board: testBoard, t: performance.now(), auraBinds,
            selected: dragging ? { r: 0, c: 0 } : null,
            floatPos: dragging ? { x: CELL * 2, y: CELL * 2 } : null,
            dragging, clearingCells: [] });
        } finally { context.drawImage = original; }
        return overlays;
      };
      return [count({}), count({ 0: 2 }), count({ 0: 2, 3: 2 }), count({ 0: 2 }, true)];
    });
    assert.deepEqual(chainOverlays, [0, 1, 2, 1], '鎖はバインド中の色だけに重なり、掴んだオーラにも追従する');
    // Status icons and full-screen dialogue must never consume board layout space.
    const boardRect=()=>page.locator('#board').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,y:el.getBoundingClientRect().y}));
    const baseline=await boardRect();
    assert.equal(await page.locator('.unit-statuses [data-effect="bind"]').count(),3);
    assert.equal(await page.locator('#playerEffects [data-effect="timeFixed"]').count(),1);
    await page.locator('.unit-statuses [data-effect="bind"]').first().click();
    assert.equal(await page.locator('#skillConfirmModal.show').count(),0);
    await page.evaluate(async()=>{
      const {renderPlayerBadges}=await import('/src/js/battle/player-badges.js');
      const copy=battleTest.snapshot().run;
      copy.enemyEffects.time={type:'timeReduce',seconds:3,turns:5};
      copy.enemyEffects.auraBinds={0:2,1:2,2:2,3:2,4:2};
      copy.buffs={atk:{mult:1.5,turns:2},guard:{rate:.5,turns:3}};copy.turnTimeBonusMs=2000;
      renderPlayerBadges(copy);
      (await import('/src/js/battle/renderer.js')).resizeBoard();
    });
    assert.deepEqual(await boardRect(),baseline);
    assert.equal(await page.locator('#playerEffects .player-badge').count(),9);
    assert.equal(await page.locator('.player-badge-art').first().evaluate(async el=>{
      const img=new Image();img.src=getComputedStyle(el).backgroundImage.slice(5,-2);await img.decode();return img.naturalWidth;
    }),1024);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-player-statuses.png')});
    await page.evaluate(async()=>{
      const {bossDialogue}=await import('/src/js/battle/raid-presentation.js');
      window.dialogueDone=false;bossDialogue('キュウコ','ふふ……あなたは、この幻を見破れるかしら？').then(()=>window.dialogueDone=true);
      (await import('/src/js/battle/renderer.js')).resizeBoard();
    });
    assert.equal(await page.locator('#bossDialogue:modal').count(),1);
    assert.deepEqual(await boardRect(),baseline);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-dialogue-modal.png')});
    await page.locator('#bossDialogue button').click();
    await page.waitForFunction(()=>window.dialogueDone);
    assert.deepEqual(await boardRect(),baseline);
    await page.evaluate(async()=>{(await import('/src/js/battle/player-badges.js')).renderPlayerBadges(battleTest.snapshot().run);});
    for(const viewport of [{width:320,height:568},{width:768,height:1024}]){
      await page.setViewportSize(viewport);
      await page.evaluate(async()=>{(await import('/src/js/battle/renderer.js')).resizeBoard();});
      const size=await boardRect();
      await page.evaluate(async()=>{
        const {bossDialogue}=await import('/src/js/battle/raid-presentation.js');
        window.dialogueDone=false;bossDialogue('敵','盤面を動かさず表示するセリフ').then(()=>window.dialogueDone=true);
        (await import('/src/js/battle/renderer.js')).resizeBoard();
      });
      assert.deepEqual(await boardRect(),size);
      await page.keyboard.press('Escape');await page.waitForFunction(()=>window.dialogueDone);
      assert.deepEqual(await boardRect(),size);
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.foe-badges .enemy-badge').count(),5);
    await page.locator('[data-effect="buildUp"]').click();
    assert.match(await page.locator('[data-effect="buildUp"]').getAttribute('aria-label'),/攻撃力が2倍/);
    await page.waitForTimeout(1800);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-enemy-badges.png')});
    assert.equal(await page.locator('.enemy-badge-art').first().evaluate(async el => {
      const url=getComputedStyle(el).backgroundImage.slice(5,-2);
      const img=new Image();img.src=url;await img.decode();return img.naturalWidth;
    }),640);
    await page.evaluate(async()=>{
      const {renderEnemyBadges}=await import('/src/js/battle/enemy-badges.js');
      const effects=battleTest.snapshot().run.enemyEffects;
      effects.resolve.active=false;
      renderEnemyBadges(effects);
    });
    assert.equal(await page.locator('[data-effect="resolve"]').count(),0);
    await page.evaluate(async()=>{
      const {renderEnemyBadges}=await import('/src/js/battle/enemy-badges.js');
      renderEnemyBadges(battleTest.snapshot().run.enemyEffects);
    });
    // Exercise every visual, including custom shapes and targeted projectiles.
    for (const effect of [
      {type:'bind',targets:[0,2]}, {type:'skillDelay',targets:[1],turns:3},
      {type:'comboGuard',chains:4}, {type:'shapeGuard',shape:'L'},
      {type:'auraBind',aura:0}, {type:'timeReduce',seconds:3},
      {type:'timeFixed',seconds:5},
      // 先制行動は演出を出さない仕様(d003cea)なので、描画の検証対象から外す
      {type:'auraAbsorb',aura:1}, {type:'buildUp'}, {type:'resolve',triggered:true}
    ]) {
      await page.evaluate(async effect => {
        const {playEnemyMotion} = await import('/src/js/battle/enemy-motion.js');
        window.motionDone = playEnemyMotion([effect],Array.from({length:8},()=>Array(7).fill(0)));
      }, effect);
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.enemy-motion').count(),1);
      assert.equal(await page.locator('.enemy-motion').evaluate(c=>getComputedStyle(c).pointerEvents),'none');
      const painted = await page.locator('.enemy-motion').evaluate(c=>{
        const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        return pixels.some((v,i)=>i%4===3 && v>0);
      });
      assert.equal(painted,true,effect.type);
      if(effect.type==='bind')await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-enemy-bind.png')});
      await page.evaluate(()=>window.motionDone);
      assert.equal(await page.locator('.enemy-motion').count(),0);
    }
    /* 演出の長さ。操作時間をいじられたことは盤面を見ても分からないので、
       時計は既定(720ms)よりはっきり長く置く。モヤも同じ理由でゆっくり飛ばす。
       「出ている」だけを見ていると短くしても気付けないので、長さそのものを測る。 */
    for (const [type, floor] of [['timeReduce',1200], ['bind',1000], ['comboGuard',0]]) {
      const lived = await page.evaluate(async type => {
        const {playEnemyMotion} = await import('/src/js/battle/enemy-motion.js');
        const t0 = performance.now();
        await playEnemyMotion([{type, seconds:3, turns:2, targets:[0], count:1, chains:3}],
          Array.from({length:8},()=>Array(7).fill(0)));
        return Math.round(performance.now() - t0);
      }, type);
      assert.ok(lived >= floor, `${type} の演出が短い(${lived}ms < ${floor}ms)`);
      // 既定の 720ms 前後のものまで引きずられていないこと
      if (floor === 0) assert.ok(lived < 1000, `関係ない演出まで伸びている(${lived}ms)`);
    }

    /* 形ガードのシールド。効いているあいだ、敵の前に必要な形を出す。
       判定に使う形とずれると直しようのない理不尽になるので、
       マス数と位置の両方を見る。 */
    const shieldOf = () => page.evaluate(() => {
      const el = document.querySelector('#enemyRoster .foe-shield');
      const svg = el && el.querySelector('svg');
      if (!svg) return { hidden: el ? el.hidden : true, cells: 0 };
      const foe = el.closest('.foe').getBoundingClientRect(), b = svg.getBoundingClientRect();
      return { hidden: el.hidden, cells: svg.querySelectorAll('rect').length,
        offX: +((b.x + b.width/2) - (foe.x + foe.width/2)).toFixed(1) };
    });
    let shield = await shieldOf();
    assert.equal(shield.hidden, false, '形ガード中なのにシールドが出ていない');
    assert.equal(shield.cells, 5, 'L字のマス数が合わない');
    assert.ok(Math.abs(shield.offX) <= 1, `シールドが敵の中央からずれている(${shield.offX}px)`);
    // 形が変われば描き直し、効果が切れれば消える
    await page.evaluate(async () => {
      const {renderEnemyShield} = await import('/src/js/battle/enemy-shield.js');
      renderEnemyShield({defenses:[{type:'shapeGuard',shape:'square'}]},
        document.querySelector('#enemyRoster .foe-shield'));
    });
    assert.equal((await shieldOf()).cells, 4, '形を変えても描き直されていない');
    await page.evaluate(async () => {
      const {renderEnemyShield} = await import('/src/js/battle/enemy-shield.js');
      renderEnemyShield({defenses:[]}, document.querySelector('#enemyRoster .foe-shield'));
    });
    shield = await shieldOf();
    assert.equal(shield.hidden, true, '形ガードが切れてもシールドが残っている');
    assert.equal(shield.cells, 0, 'シールドの中身が残っている');

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(async()=>{
      const {playEnemyMotion}=await import('/src/js/battle/enemy-motion.js');
      await playEnemyMotion([{type:'resolve'}]);
    });
    assert.equal(await page.locator('.enemy-motion').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
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
    assert.deepEqual(after.run.skillDelayDebt,[3,3,3]);
    assert.equal(await page.locator('.unit-statuses [data-effect="skillDelay"]').count(),3);
    assert.equal(await page.locator('#partyRow .bound').count(), 0);
    assert.ok(await page.evaluate(() => battleTest.dragTimeMs()) > 2000);
    await page.evaluate(async () => {
      const { STAGES } = await import('/src/js/data/gamedata.js');
      const { startDungeonRun } = await import('/src/js/battle/battle.js');
      const { LESSONS, lessonBoard } = await import('/src/js/data/training.js');
      const stage=structuredClone(STAGES[0]);
      stage.floors[0].hp=100000;stage.floors[0].interval=99;
      startDungeonRun(stage,false,null);
      battleTest.setCooldowns([1,1,1]);
      battleTest.setBoard(lessonBoard(LESSONS[0]));
      window.attackTurn = battleTest.resolveTurn();
    });
    await page.waitForFunction(()=>document.querySelector('.unit-pending:not([hidden])'));
    await page.waitForTimeout(1050);
    assert.ok(await page.locator('.unit-pending:not([hidden])').count()>0);
    assert.equal(await page.evaluate(()=>battleTest.snapshot().run.enemyHP),100000);
    await page.waitForFunction(()=>document.querySelector('.party-projectile'),null,{polling:'raf',timeout:10000});
    assert.ok(await page.locator('.unit-pending:not([hidden])').count()>0);
    assert.equal(await page.evaluate(()=>battleTest.snapshot().run.enemyHP),100000);
    assert.equal(await page.locator('.party-projectile').first().evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-party-attack.png')});
    await page.evaluate(()=>window.attackTurn);
    assert.equal(await page.locator('.unit-pending:not([hidden])').count(),0);
    assert.equal(await page.locator('.party-projectile').count(),0);
    assert.ok(await page.evaluate(()=>battleTest.snapshot().run.enemyHP)<100000);
    assert.equal(await page.evaluate(()=>battleTest.snapshot().run.chanceActive),true);
    assert.equal(await page.locator('#chanceNotice').isVisible(),true);
    /* チャンス盤面の光。隙間なく埋めたぶん梯子が絵に紛れるので、
       入れ替える2マスだけ示す。指す先が正解であることは
       tests/chance.test.mjs が見ているので、ここは出ていることだけ。 */
    const chanceHint = await page.evaluate(()=>battleTest.snapshot().run.chanceHint);
    assert.ok(Array.isArray(chanceHint)&&chanceHint.length===2,'チャンス盤面の光が用意されていない');
    assert.equal(Math.abs(chanceHint[0][0]-chanceHint[1][0])+Math.abs(chanceHint[0][1]-chanceHint[1][1]),1,
      '光った2マスが隣り合っていない');
    // 空きがあると5連鎖止まりになり、消えたあと全消しループにもなる
    assert.equal(await page.evaluate(()=>battleTest.snapshot().board.flat().filter(v=>v===-1).length),0,
      'チャンス盤面に空きマスが残っている');
    assert.equal(await page.locator('#partyRow .ready').count(),3);
    assert.equal(await page.locator('.unit-ready-burst:not([hidden])').count(),3);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-chance-ready.png')});
    await page.waitForTimeout(1850);
    await page.evaluate(()=>battleTest.setCooldowns([0,0,0]));
    assert.equal(await page.locator('.unit-ready-burst:not([hidden])').count(),0);
    assert.equal(await page.locator('.unit-ready-label').count(),0);
    await page.evaluate(()=>{
      const board=Array.from({length:8},()=>Array(7).fill(1));
      board[7][0]=0;board[6][0]=0;board[7][1]=2;
      battleTest.setBoard(board);
      battleTest.useTestSkill({name:'変換テスト',cooldown:5,convert:[{from:'c0',to:'c1'},{from:'c2',to:'c4'}]});
    });
    assert.equal(await page.evaluate(()=>conversionTest().cells.length),3);
    assert.deepEqual(await page.evaluate(()=>conversionTest().cells.map(c=>c.to).sort()),[1,1,4]);
    await page.waitForTimeout(220);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-conversion.png')});
    await page.waitForFunction(()=>conversionTest()===null);
    assert.equal(await page.evaluate(()=>battleTest.snapshot().board[7][1]),4);
    /* スキルでダメージを出すときも、通常攻撃と同じ弾を敵へ飛ばす。
       弾が飛んでいるあいだは resolving にして二重押しを止めているので、そこも見る。 */
    await page.evaluate(()=>{
      window.skillShot = battleTest.useTestSkill({name:'砲撃テスト',cooldown:5,fixedDamage:2});
    });
    await page.waitForFunction(()=>document.querySelector('.party-projectile'),null,{polling:'raf',timeout:10000});
    assert.equal(await page.evaluate(()=>battleTest.snapshot().bstate),'resolving',
      'スキルの弾が飛んでいる間に入力を止めていない(同じスキルを二度押せる)');
    await page.evaluate(()=>window.skillShot);
    assert.equal(await page.locator('.party-projectile').count(),0,'スキルの弾が残っている');
    assert.equal(await page.evaluate(()=>battleTest.snapshot().bstate),'idle','スキルのあと操作に戻っていない');

    // 光は「見つける」ためのものなので、操作に入ったら消す
    assert.notEqual(await page.evaluate(()=>battleTest.snapshot().run.chanceHint),null,
      'まだ手番に入っていないのに光が消えている');
    const boardBox = await page.locator('#board').boundingBox();
    await page.mouse.move(boardBox.x+boardBox.width/2, boardBox.y+boardBox.height/2);
    await page.mouse.down();
    await page.waitForFunction(()=>battleTest.snapshot().bstate==='dragging');
    assert.equal(await page.evaluate(()=>battleTest.snapshot().run.chanceHint),null,
      'オーラを掴んでも光が消えていない');
    await page.mouse.up();

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
    assert.equal(await page.locator('.foe-badges .enemy-badge').count(),0);
    assert.equal(await page.evaluate(() => battleTest.snapshot().run), null);
    assert.deepEqual(errors, []);
    console.log('PASS: preemptive input lock, bind attack/heal suppression, aura bind, fixed time expiry, full skill delay, status UI, next-floor preemptive defeat');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
