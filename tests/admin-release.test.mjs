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
  }]
};

async function loadGenerated(draft) {
  const dir = await mkdtemp(join(tmpdir(), 'acb-custom-'));
  const file = join(dir, 'custom.mjs');
  await writeFile(file, buildCustomJs(draft), 'utf8');
  return { module: await import(`file://${file}`), text: await readFile(file, 'utf8') };
}

test('空の下書きからでも、読み込める custom.js になる', async () => {
  const { module } = await loadGenerated({ enemies: [], raids: [], characters: [] });
  assert.deepEqual(module.CUSTOM_ENEMIES, []);
  assert.deepEqual(module.CUSTOM_RAIDS, []);
  assert.deepEqual(module.CUSTOM_CHARACTERS, []);
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

test('書き出した custom.js は、ゲーム側が期待する3つの配列を必ず持つ', async () => {
  const { module } = await loadGenerated(SAMPLE);
  [module.CUSTOM_ENEMIES, module.CUSTOM_RAIDS, module.CUSTOM_CHARACTERS]
    .forEach(v => assert.ok(Array.isArray(v)));
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
