import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCustomJs, VERSION_FILES, nextVersion } from '../admin/js/custom-source.js';

/* 管理ツールが書き出す custom.js は、そのままリポジトリのソースになる。
   壊れた JS を push するとゲームが起動しなくなるので、
   「本当に import できる JS か」をここで確かめておく。 */

const SAMPLE = {
  enemies: [{
    id: 'testgolem', name: 'テスト"ゴーレム"', emoji: '🗿',
    sprite: 'assets/enemy/testgolem.webp', hp: 5000, atk: 120, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'comboGuard', chains: 4, turns: 3 }] } },
    _artName: 'testgolem', _new: true, _source: 'draft'
  }],
  raids: [{
    id: 2002, name: 'テスト降臨 <重要>', stamina: 30,
    floors: [{ enemies: [{ id: 'testgolem', form: 0, mult: 2.5 }] },
      { enemies: [{ id: 'kyuko', form: 1, mult: { hp: 0.5, atk: 2 } }],
        intro: 'evolution', dialogue: 'さあ、\n本当のわたくしを' }]
  }],
  characters: [{
    id: 'fl_testnova', name: 'ノヴァ', job: '検証役', portrait: '🧪',
    aura: 0, rarity: 4, role: 'tank', leaderSkillId: 'ls_blaze', skillId: 'sk_strike',
    atk: 30, hp: 80, rcv: 16, _artName: 'testnova', _form: 0
  }],
  gifts: [{
    key: 'gift_test', title: '記念<プレゼント>', note: 'ありがとう"ございます"',
    from: '2026-01-01', to: '2026-12-31', orb: 45, char: 'fl_testnova'
  }]
};

async function loadGenerated(draft, base) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-custom-'));
  const file = join(dir, 'custom.mjs');
  await writeFile(file, buildCustomJs(draft, base), 'utf8');
  return { module: await import(`file://${file}`), text: await readFile(file, 'utf8') };
}

test('空の下書きからでも、読み込める custom.js になる', async () => {
  const { module } = await loadGenerated({ enemies: [], raids: [], characters: [] });
  assert.deepEqual(module.CUSTOM_ENEMIES, []);
  assert.deepEqual(module.CUSTOM_RAIDS, []);
  assert.deepEqual(module.CUSTOM_CHARACTERS, []);
  assert.deepEqual(module.CUSTOM_GIFTS, []);
});

test('引用符・記号・改行が入っていても壊れない JS を書き出す', async () => {
  const { module } = await loadGenerated(SAMPLE);
  assert.equal(module.CUSTOM_ENEMIES[0].name, 'テスト"ゴーレム"');
  assert.equal(module.CUSTOM_RAIDS[0].name, 'テスト降臨 <重要>');
  assert.equal(module.CUSTOM_RAIDS[0].floors[1].dialogue, 'さあ、\n本当のわたくしを');
  assert.deepEqual(module.CUSTOM_RAIDS[0].floors[1].enemies[0].mult, { hp: 0.5, atk: 2 });
  assert.equal(module.CUSTOM_ENEMIES[0].enemySkills.preemptive.effects[0].chains, 4);
});

test('ツールの作業用キーはリポジトリに出さない', async () => {
  const { module, text } = await loadGenerated(SAMPLE);
  ['_artName', '_new', '_source', '_form'].forEach(k => {
    assert.ok(!text.includes(`"${k}"`), `${k} が書き出されている`);
  });
  assert.equal(module.CUSTOM_CHARACTERS[0]._artName, undefined);
  // 中身そのものは落ちていないこと
  assert.equal(module.CUSTOM_CHARACTERS[0].name, 'ノヴァ');
  assert.equal(module.CUSTOM_CHARACTERS[0].atk, 30);
});

test('書き出した custom.js は、ゲーム側が期待する配列を必ず持つ', async () => {
  const { module } = await loadGenerated(SAMPLE);
  [module.CUSTOM_ENEMIES, module.CUSTOM_RAIDS, module.CUSTOM_CHARACTERS, module.CUSTOM_GIFTS]
    .forEach(v => assert.ok(Array.isArray(v)));
});

test('プレゼントは key・期間・中身をそのまま運ぶ', async () => {
  const { module } = await loadGenerated(SAMPLE);
  const g = module.CUSTOM_GIFTS[0];
  assert.equal(g.key, 'gift_test');
  assert.equal(g.title, '記念<プレゼント>');
  assert.equal(g.note, 'ありがとう"ございます"');
  assert.equal(g.from, '2026-01-01');
  assert.equal(g.to, '2026-12-31');
  assert.equal(g.orb, 45);
  assert.equal(g.char, 'fl_testnova');
});

test('下書きが空でも、いま入っているものは消えない', async () => {
  // push のたびに下書きは空になる。base を足さずに書くと、前に push した
  // キャラや設定が次の push で消える(実際に一度消えた)
  const base = {
    characters: [{ id: 'lm_keep', name: '残る子', rarity: 4 }],
    skills: [{ id: 'sk_keep', name: '残るスキル' }],
    leaderSkills: [{ id: 'ls_keep', name: '残るLS' }],
    gifts: [{ key: 'gift_keep', title: '残る配布', orb: 10 }],
    settings: { pickupId: 'lm_keep', pickupRate: 0.3 }
  };
  const { module } = await loadGenerated({ enemies: [], raids: [], characters: [] }, base);
  assert.equal(module.CUSTOM_CHARACTERS[0].id, 'lm_keep');
  assert.equal(module.CUSTOM_SKILLS[0].id, 'sk_keep');
  assert.equal(module.CUSTOM_LEADER_SKILLS[0].id, 'ls_keep');
  assert.equal(module.CUSTOM_GIFTS[0].key, 'gift_keep');
  assert.equal(module.CUSTOM_SETTINGS.pickupId, 'lm_keep');
});

test('同じ id と key は下書きで上書きし、違うものは足す', async () => {
  const base = {
    characters: [{ id: 'lm_keep', name: '前の名前', rarity: 4 }],
    gifts: [{ key: 'gift_keep', title: '前の配布', orb: 10 }],
    settings: { pickupId: 'lm_keep', pickupRate: 0.3 }
  };
  const draft = {
    characters: [{ id: 'lm_keep', name: '新しい名前', rarity: 4 }, { id: 'lm_new', name: '追加', rarity: 3 }],
    gifts: [{ key: 'gift_new', title: '新しい配布', orb: 45 }],
    settings: { pickupId: 'lm_new' }
  };
  const { module } = await loadGenerated(draft, base);
  assert.deepEqual(module.CUSTOM_CHARACTERS.map(c => c.name), ['新しい名前', '追加']);
  assert.deepEqual(module.CUSTOM_GIFTS.map(g => g.key), ['gift_keep', 'gift_new']);
  assert.deepEqual(module.CUSTOM_SETTINGS, { pickupId: 'lm_new', pickupRate: 0.3 });
});

test('版の3か所を、実際のファイルから読めて書き換えられる', async () => {
  for (const f of VERSION_FILES) {
    const text = await readFile(new URL(`../${f.path}`, import.meta.url), 'utf8');
    const current = f.read(text);
    assert.ok(/^\d+$/.test(current || ''), `${f.path} から版が読めない`);
    const bumped = f.write(text, nextVersion(current));
    assert.equal(f.read(bumped), nextVersion(current), `${f.path} の書き換えが効いていない`);
    // 版のところ以外は1文字も変えない
    assert.equal(bumped.replace(nextVersion(current), current).length, text.length);
  }
});

test('3か所の版がいま揃っている', async () => {
  const found = [];
  for (const f of VERSION_FILES) {
    const text = await readFile(new URL(`../${f.path}`, import.meta.url), 'utf8');
    found.push(f.read(text));
  }
  assert.equal(new Set(found).size, 1, `版がずれている: ${found.join(' / ')}`);
});

test('版の +1 は数字のときだけ', () => {
  assert.equal(nextVersion('48'), '49');
  assert.equal(nextVersion('9'), '10');
  assert.equal(nextVersion('あ'), null);
  assert.equal(nextVersion(''), null);
});

/* ===================== アトラスの索引 ===================== */
import { buildAtlasIndexJs } from '../admin/js/atlas.js';
import { CHAR_ATLAS, CHAR_ATLAS_COLUMNS, CHAR_ATLAS_ROWS } from '../src/js/data/char-atlas.js';

test('管理ツールが作る char-atlas.js は、いまのものと同じ形になる', async () => {
  // いまリポジトリにあるものを、そのまま入力にして書き出し直す。
  // build-char-atlas.py と同じ結果にならないと、焼き直しで一覧が崩れる。
  const text = buildAtlasIndexJs({
    index: CHAR_ATLAS, columns: CHAR_ATLAS_COLUMNS, rows: CHAR_ATLAS_ROWS
  });
  const dir = await mkdtemp(join(tmpdir(), 'acb-atlas-'));
  const file = join(dir, 'char-atlas.mjs');
  await writeFile(file, text, 'utf8');
  const mod = await import(`file://${file}`);

  assert.equal(mod.CHAR_ATLAS_COLUMNS, CHAR_ATLAS_COLUMNS);
  assert.equal(mod.CHAR_ATLAS_ROWS, CHAR_ATLAS_ROWS);
  assert.equal(mod.CHAR_ATLAS_SRC, 'assets/chars/char_atlas.webp');
  assert.deepEqual(mod.CHAR_ATLAS, CHAR_ATLAS, '格子の位置が変わってしまっている');
});

test('アトラスの索引は名前順で、格子からはみ出さない', async () => {
  const keys = Object.keys(CHAR_ATLAS);
  assert.deepEqual(keys, keys.slice().sort(), '並びが名前順でない(差分が読みにくくなる)');
  keys.forEach(k => {
    const [col, row] = CHAR_ATLAS[k];
    assert.ok(col >= 0 && col < CHAR_ATLAS_COLUMNS, `${k} の列が範囲外`);
    assert.ok(row >= 0 && row < CHAR_ATLAS_ROWS, `${k} の行が範囲外`);
  });
  // 同じマスに2枚入っていないこと
  const seen = new Set(keys.map(k => CHAR_ATLAS[k].join(',')));
  assert.equal(seen.size, keys.length, '同じマスに重なっているアイコンがある');
});
