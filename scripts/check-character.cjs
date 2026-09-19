/* キャラクター画面(編成 / 強化・進化 / 開眼 / 送還)と、ダンジョン出撃の3段を通す。
   node scripts/check-character.cjs                                  */
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
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);

    // 全キャラを所持数・レベル・開眼ばらばらで持たせ、一覧とソートを実データで見る
    await page.evaluate(async () => {
      const { CHARACTERS, maxLevelFor, awakenMaxFor } = await import('/src/js/data/gamedata.js');
      const chars = {};
      CHARACTERS.forEach((c, i) => {
        chars[c.id] = { n: 1 + (i % 4), star: c.rarity, lv: Math.min(maxLevelFor(c.rarity), 1 + i * 2),
          xp: 0, awa: i % (awakenMaxFor(c) + 1), at: Date.now() - i * 60000 };
      });
      const raw = JSON.parse(localStorage.getItem('acb_state'));
      raw.characters = chars; raw.coin = 900000;
      Object.keys(raw.materials).forEach(k => { raw.materials[k] = 300; });
      raw.teams[1] = [CHARACTERS[5].id, CHARACTERS[9].id, CHARACTERS[14].id];
      localStorage.setItem('acb_state', JSON.stringify(raw));
    });
    const asked = [];
    page.on('request', r => { if (r.url().includes('char_atlas.webp')) asked.push(r.url()); });
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    /* キャラアイコンのアトラスは起動中に取りに行っておくこと。
       素材のなかで一番大きい(約540KB)うえに、キャラ一覧・ガチャ・
       サポート選択とほぼ全部の画面で使う。必要になってから取りに行くと、
       最初に開いた画面でアイコンだけ遅れて出てくる(実測で「開くまで
       リクエストすらされない」状態だった)。
       ただし BASE_IMAGES には入れないこと。起動がそのぶん丸ごと長くなる。 */
    assert.ok(asked.length > 0,
      'キャラアトラスが起動中に読み込まれていない(画面を開いてから取りに行くと出遅れる)');
    const toMenu = async () => { await page.locator('[data-charpage="menu"]:visible').first().click(); };

    /* --- 入口は5つ --- */
    await page.locator('.menu-tile.t-char').click();
    assert.deepEqual(await page.locator('#charMenu .char-entry b').allTextContents(),
      ['編成', '強化・進化', '開眼', '送還', '図鑑']);
    // 図鑑は進化前と進化後を並べ、未所持も出す
    await page.locator('[data-charpage="catalog"]').click();
    assert.ok(await page.locator('#allCharacterList .catalog-card').count() >= 20);
    assert.equal(await page.locator('#allCharacterList .catalog-card .catalog-form').count(),
      await page.locator('#allCharacterList .catalog-card').count() * 2);
    await page.locator('#allCharacterList .catalog-form').first().click();
    assert.equal(await page.locator('#charDetailBody .catalog-switch').count(), 1, '進化前/後の切り替えがない');
    await page.locator('#charDetailCloseBtn').click();
    await toMenu();

    /* --- 強化・進化: アイコンにレベルと★が乗り、ソートが効く --- */
    await page.locator('[data-charpage="enhance"]').click();
    const cells = await page.locator('#charGrid .cg-cell').count();
    assert.ok(cells >= 20, `一覧が少なすぎる: ${cells}`);
    assert.equal(await page.locator('#charGrid .cg-lv').count(), cells);
    assert.equal(await page.locator('#charGrid .cg-star').count(), cells);
    const order = () => page.locator('#charGrid .cg-name').allTextContents();
    const byGet = await order();
    await page.locator('.sort-btn', { hasText: 'レベル' }).first().click();
    const levels = (await page.locator('#charGrid .cg-lv').allTextContents()).map(t => Number(t.replace('Lv', '')));
    assert.deepEqual(levels, [...levels].sort((a, b) => b - a), 'レベル順に並んでいない');
    assert.notDeepEqual(byGet, await order(), 'ソートしても並びが変わらない');
    await page.locator('.sort-btn', { hasText: '入手順' }).first().click();

    // 詳細は強化と進化だけ。開眼の箱は出さない
    await page.locator('#charGrid .cg-cell').first().click();
    assert.deepEqual(await page.evaluate(() => ['charExpBox', 'charEvolveBox', 'charAwakenBox']
      .map(id => !document.getElementById(id).hidden)), [true, true, false]);
    await page.locator('#charDetailCloseBtn').click();

    /* --- 開眼: アイコンに🔸、詳細は開眼だけ --- */
    await toMenu();
    await page.locator('[data-charpage="awaken"]').click();
    assert.ok(await page.locator('#charGrid .cg-cell .aw-pip').count() > 0, '開眼の🔸が出ていない');
    // 点灯・消灯とも不透明の色。半透明だと後ろの絵で色が変わって見える
    const pipColors = await page.evaluate(() => {
      const on = document.querySelector('#charGrid .aw-pip.on');
      const off = document.querySelector('#charGrid .aw-pip:not(.on)');
      return [on && getComputedStyle(on).color, off && getComputedStyle(off).color];
    });
    pipColors.filter(Boolean).forEach(c =>
      assert.ok(!/rgba/.test(c), `開眼の◆が半透明(${c})。絵によって色が変わって見える`));
    // 10段階のキャラは5つ×2行に折り返す(1行だとセルからはみ出す)
    const wide = await page.evaluate(() => {
      const cell = [...document.querySelectorAll('#charGrid .cg-cell')]
        .find(c => c.querySelectorAll('.aw-pip').length > 5);
      if (!cell) return null;
      const pips = [...cell.querySelectorAll('.aw-pip')];
      const rows = new Set(pips.map(p => Math.round(p.getBoundingClientRect().y)));
      const box = cell.querySelector('.aw-pips').getBoundingClientRect();
      return { count: pips.length, rows: rows.size,
        perRow: Math.round(pips.length / rows.size),
        w: Math.round(box.width), cellW: Math.round(cell.getBoundingClientRect().width) };
    });
    assert.ok(wide, '10段階のキャラが一覧にいない');
    assert.equal(wide.rows, 2, `10段階の◆が${wide.rows}行になっている`);
    assert.equal(wide.perRow, 5, `1行あたり${wide.perRow}個になっている`);
    assert.ok(wide.w < wide.cellW * 0.8,
      `◆の並びがセルに収まっていない(${wide.w}px / セル${wide.cellW}px)`);
    await page.locator('#charGrid .cg-cell').first().click();
    assert.deepEqual(await page.evaluate(() => ['charExpBox', 'charEvolveBox', 'charAwakenBox']
      .map(id => !document.getElementById(id).hidden)), [false, false, true]);
    // 立ち絵と開眼だけ。ステータスやスキルは出さない
    assert.equal(await page.locator('#charDetailBody .cd-stats').count(), 0);
    assert.equal(await page.locator('#charDetailBody .skill-line').count(), 0);
    assert.equal(await page.locator('#charDetailBody .cd-art').count(), 1);
    await page.locator('#charDetailCloseBtn').click();

    /* --- 送還: 初期値は所持数、±で動く、まとめて送還が効く --- */
    await toMenu();
    await page.locator('[data-charpage="dismiss"]').click();
    const dup = page.locator('#charGrid .cg-cell').filter({ has: page.locator('.cg-count') }).first();
    await dup.click();
    const shown = Number(await page.locator('#dismissCount').textContent());
    const max = Number((await page.locator('#dismissMax').textContent()).replace('/', '').trim());
    assert.equal(shown, max, '送還の初期値が所持数と違う');
    await page.locator('#dismissMinusBtn').click();
    assert.equal(Number(await page.locator('#dismissCount').textContent()), max - 1);
    await page.locator('#dismissPlusBtn').click();
    assert.equal(Number(await page.locator('#dismissCount').textContent()), max);
    await page.locator('#dismissCancelBtn').click();

    const read = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      return { kinds: Object.keys(s.characters).length,
        total: Object.values(s.characters).reduce((a, e) => a + e.n, 0), coin: s.coin };
    });
    await page.locator('#charBulkToggleBtn').click();
    await page.locator('#charBulkDupBtn').click();       // 被りだけ(1体は残す)
    const before = await read();
    page.once('dialog', d => d.accept());
    await page.locator('#bulkRunBtn').click();
    await page.waitForTimeout(400);
    const after = await read();
    assert.equal(after.kinds, before.kinds, '被りだけの送還で種類が減っている');
    assert.ok(after.total < before.total, '送還で手持ちが減っていない');
    assert.ok(after.coin > before.coin, '送還でコインが増えていない');

    /* --- 編成: プリセット切り替えと枠の入れ替え --- */
    await toMenu();
    await page.locator('[data-charpage="team"]').click();
    assert.equal(await page.locator('.preset-btn').count(), 5);
    await page.locator('.preset-btn').nth(1).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).teamIndex), 1);
    const preset0 = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).teams[0].slice());
    const leaderBefore = await page.locator('#teamSlots .teamslot .slot-name').first().textContent();
    await page.locator('#teamSlots .teamslot').first().click();
    const pick = page.locator('#teamPickGrid .cg-cell').filter({ hasNot: page.locator('.cg-badge') }).first();
    const pickName = await pick.locator('.cg-name').textContent();
    await pick.click();
    assert.equal(await page.locator('#teamSlots .teamslot .slot-name').first().textContent(), pickName);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).teams[0]),
      preset0, '他のプリセットまで書き換わっている');

    // すでに別の枠にいるキャラを選ぶと、その枠と入れ替わる
    const sub1 = await page.locator('#teamSlots .teamslot .slot-name').nth(1).textContent();
    await page.locator('#teamSlots .teamslot').first().click();
    await page.locator('#teamPickGrid .cg-cell').filter({ hasText: sub1 }).first().click();
    const slots = await page.locator('#teamSlots .teamslot .slot-name').allTextContents();
    assert.equal(slots[0], sub1);
    assert.equal(slots[1], pickName, '入れ替え元の枠に前のリーダーが入っていない');

    /* --- 出撃: チーム → サポート → 確認 → 突入 --- */
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('dungeon'); });
    await page.locator('#openStoryDungeonBtn').click();
    await page.locator('#stageList .stage-card').first().click();
    assert.ok(await page.locator('#sortieTeamStep').isVisible(), '最初はチーム選択');
    assert.equal(await page.locator('.sortie-team').count(), 5);
    // 中身のないチームは選べない(押しても手順は進まない)
    assert.equal(await page.locator('.sortie-team.empty').count(), 3);
    await page.locator('.sortie-team.empty').first().click();
    assert.ok(await page.locator('#sortieTeamStep').isVisible(), '空のチームで進んでしまった');
    await page.locator('.sortie-team').nth(1).click();     // 2番目のチームで出る
    assert.ok(await page.locator('#sortieSupportStep').isVisible(), '次はサポート選択');
    await page.locator('#sortieBackBtn').click();
    assert.ok(await page.locator('#sortieTeamStep').isVisible(), '‹ でチーム選択へ戻る');
    await page.locator('.sortie-team').nth(1).click();
    await page.locator('#supportSkipBtn').click();
    assert.ok(await page.locator('#sortieConfirmStep').isVisible(), '最後は編成の確認');
    assert.equal(await page.locator('#sortieLineup .sl-card').count(), 4, '4人ぶん並んでいない');
    const lineup = await page.locator('#sortieLineup .sl-name').allTextContents();
    await page.locator('#sortieGoBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('in-battle'), null, { timeout: 15000 });

    // ホームに出るのは「最後に突入したチーム」
    const lastTeam = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).lastTeam);
    assert.equal(lastTeam.length, 3);
    assert.deepEqual(await page.evaluate(async ids => {
      const { resolveOwned } = await import('/src/js/core/state.js');
      return ids.map(id => resolveOwned(id).name);
    }, lastTeam), lineup.slice(0, 3), 'lastTeam が突入した3人と違う');

    /* --- アイコンは1枚のアトラスから切り出している --- */
    assert.ok(await page.locator('.char-atlas').count() > 0, 'アトラスが使われていない');
    assert.equal(await page.evaluate(() =>
      performance.getEntriesByType('resource').filter(r => /assets\/chars\/.*_icon\.webp/.test(r.name)).length),
      0, '個別のアイコン画像を読んでいる');

    /* --- 5つとも未編成でも出撃モーダルが詰まらない --- */
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state'));
      s.teams = s.teams.map(() => [null, null, null]);
      localStorage.setItem('acb_state', JSON.stringify(s));
    });
    await page.reload();
    await page.locator('#titleScreen.ready').click({ timeout: 30000 });
    const staminaBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).stamina);
    await page.evaluate(async () => { (await import('/src/js/core/nav.js')).showScreen('dungeon'); });
    await page.locator('#openStoryDungeonBtn').click();
    await page.locator('#stageList .stage-card').first().click();
    assert.equal(await page.locator('.sortie-team.empty').count(), 5);
    const hint = page.locator('#sortieTeamStep .btn', { hasText: '編成' });
    assert.equal(await hint.count(), 1, '未編成のときに編成への案内が出ていない');
    await hint.click();
    assert.ok(await page.locator('#screen-character.active').isVisible(), 'キャラクター画面へ行けない');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('acb_state')).stamina),
      staminaBefore, '突入していないのにスタミナが減っている');

    assert.deepEqual(errors, []);
    console.log('PASS: character menu, sort, per-page detail, dismiss count/bulk, team presets, 3-step sortie, empty-team guard, icon atlas');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
