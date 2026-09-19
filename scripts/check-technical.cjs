/* テクニカルダンジョン:入口・階層/難易度・全フロアの特殊行動・初クリア報酬。
   node scripts/check-technical.cjs                                        */
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
    // リザルトまで一気に進められるよう、バトルの内部に触れるようにしておく
    await page.route('**/battle/battle.js', async route => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) +
        '\nwindow.techTest={wipe:async()=>{while(run){run.enemies.forEach(e=>{e.hp=0;});await resolveTurn();}},' +
        'stage:()=>run&&run.stage.id};' });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });

    /* --- データの形 --- */
    const shape = await page.evaluate(async () => {
      const g = await import('/src/js/data/gamedata.js');
      const t = g.TECHNICAL_STAGES;
      const kinds = {};
      t.forEach(s => s.floors.forEach(f => {
        const k = f.enemySkills.passives ? f.enemySkills.passives[0].type
          : f.enemySkills.preemptive.effects[0].type;
        kinds[k] = (kinds[k] || 0) + 1;
      }));
      return {
        stages: t.length, chapters: g.TECH_CHAPTER_COUNT,
        floors: [...new Set(t.map(s => s.floors.length))],
        everyFloorHasSkill: t.every(s => s.floors.every(f =>
          f.enemySkills && ((f.enemySkills.passives || []).length || f.enemySkills.preemptive))),
        firstClearOrb: [...new Set(t.map(s => s.firstClearOrb))],
        orbReward: [...new Set(t.map(s => s.orbReward))],
        kinds,
        ids: [t[0].id, t[t.length - 1].id],
        // 通常・曜日・降臨と番号がぶつかっていないこと
        clash: t.some(s => g.STAGES.some(x => x.id === s.id)
          || [0,1,2,3,4,5,6].flatMap(d => g.dailyStagesFor(d)).some(x => x.id === s.id))
      };
    });
    console.log('ステージ', shape.stages, '/ 階層', shape.chapters, '/ 1ステージのフロア', shape.floors.join(','));
    assert.equal(shape.stages, 50, '10階層×5ステージになっていない');
    assert.equal(shape.chapters, 10);
    assert.deepEqual(shape.floors, [5], '1ステージ5フロアでない');
    assert.ok(shape.everyFloorHasSkill, '特殊行動を持たないフロアがある');
    assert.deepEqual(shape.firstClearOrb, [1], '初クリア報酬がダイヤ1個でない');
    assert.deepEqual(shape.orbReward, [0], '周回でもダイヤが出てしまう');
    assert.equal(shape.clash, false, '他のダンジョンとIDが重なっている');
    assert.ok(Object.keys(shape.kinds).length >= 8, `特殊行動の種類が少ない: ${Object.keys(shape.kinds)}`);
    assert.ok(shape.kinds.comboGuard > 0, 'コンボガードのフロアがない');
    console.log('特殊行動の内訳:', shape.kinds);

    /* --- 入口はノーマルと降臨の間 --- */
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('dungeon'); });
    assert.deepEqual(await page.locator('#dungeonMenu b').allTextContents(),
      ['ノーマルダンジョン', 'テクニカルダンジョン', '降臨ダンジョン', '曜日ダンジョン', 'トレーニング']);

    /* --- 階層タブと難易度 --- */
    await page.locator('#openTechDungeonBtn').click();
    assert.equal(await page.locator('#chapterBar .chapter-btn').count(), 10, '階層タブが10個でない');
    assert.deepEqual(await page.locator('#storyControls .segmented button').allTextContents(), ['ノーマル', 'ハード']);
    assert.equal(await page.locator('#stageList .stage-card').count(), 5, '1階層が5ステージでない');
    // 先に進んだステージは鍵。ハードはノーマルをクリアするまで開かない
    assert.equal(await page.locator('#stageList .stage-card.locked').count(), 4);
    await page.locator('#diffHardBtn').click();
    assert.equal(await page.locator('#stageList .stage-card.locked').count(), 5, 'ハードが最初から開いている');
    await page.locator('#diffNormalBtn').click();
    // 未取得の初クリア報酬がカードに出る
    assert.ok(await page.locator('#stageList .stage-card .first-orb').count() > 0, '初クリア報酬の表示がない');

    /* --- 1フロア目から特殊行動が出る --- */
    const orbBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).orb);
    await page.locator('#stageList .stage-card').first().click();
    await page.locator('.sortie-team').first().click();
    await page.locator('#supportSkipBtn').click();
    await page.locator('#sortieGoBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('in-battle'), null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    const marks = await page.evaluate(() => document.querySelectorAll('#enemyRoster .foe-badges .enemy-badge').length
      + document.querySelectorAll('#playerEffects .player-badge').length);
    assert.ok(marks > 0, '1フロア目に特殊行動の表示が出ていない');

    /* 敵の絵が枠の中央に来ていること。
       iOS の <button> は align-items が stretch にならず、中の .foe-art が
       絵の幅まで縮んで左端に寄っていた。敵が1体のとき(枠300px・絵は半分ほど)に
       いちばん目立つので、実際に戦闘に入っているここで測る。 */
    const artOff = await page.evaluate(() => [...document.querySelectorAll('#enemyRoster .foe')]
      .map(foe => {
        const img = foe.querySelector('.enemy-img');
        if (!img) return null;
        const c = el => { const b = el.getBoundingClientRect(); return b.x + b.width / 2; };
        return { only: !!foe.parentElement && foe.parentElement.children.length === 1,
                 off: +(c(img) - c(foe)).toFixed(1) };
      }).filter(Boolean));
    artOff.forEach(a => assert.ok(Math.abs(a.off) <= 1,
      `敵の絵が枠の中央からずれている(${a.off}px${a.only ? '・1体のとき' : ''})`));
    assert.equal(await page.evaluate(() => techTest.stage()), 3001);

    /* --- 初クリアでダイヤ1個。2回目は配らない --- */
    await page.evaluate(() => techTest.wipe());
    await page.waitForSelector('#resultModal.show', { timeout: 20000 });
    const reward = (await page.locator('#resultRewards').textContent()).replace(/\s+/g, ' ').trim();
    console.log('初クリアの報酬:', reward);
    assert.ok(await page.locator('#resultRewards .first-clear').count() === 1, '初クリア報酬の行が出ていない');
    const orbFirst = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).orb);
    assert.equal(orbFirst, orbBefore + 1, `初クリアでダイヤが1個増えていない(${orbBefore}→${orbFirst})`);
    await page.locator('#resultBtn').click();

    await page.locator('#stageList .stage-card').first().click();
    await page.locator('.sortie-team').first().click();
    await page.locator('#supportSkipBtn').click();
    await page.locator('#sortieGoBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('in-battle'), null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => techTest.wipe());
    await page.waitForSelector('#resultModal.show', { timeout: 20000 });
    assert.equal(await page.locator('#resultRewards .first-clear').count(), 0, '2回目にも初クリア報酬が出ている');
    const orbAgain = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).orb);
    assert.equal(orbAgain, orbFirst, `2回目でもダイヤが増えている(${orbFirst}→${orbAgain})`);
    console.log(`ダイヤ: ${orbBefore} → 初クリア ${orbFirst} → 2回目 ${orbAgain}`);

    assert.deepEqual(errors, []);
    console.log('PASS: テクニカル10階層×5ステージ×5フロア、全フロア特殊行動、初クリアのダイヤは1回だけ');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
