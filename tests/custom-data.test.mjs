import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_MASTER, enemyMasterById, enemyFormOf, formCountOf, spawnEnemy, isBossEnemy
} from '../src/js/data/enemy-master.js';
import { ENEMIES, buildEnemyPool } from '../src/js/data/enemies.js';
import { KYUKO_RAID, RAID_STAGES } from '../src/js/data/raids.js';
import { CUSTOM_ENEMIES, CUSTOM_RAIDS, CUSTOM_CHARACTERS } from '../src/js/data/custom.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

test('custom.js は3つのキーを必ず配列で持つ(管理者ツールが壊れた形を書いたら気づく)', () => {
  [CUSTOM_ENEMIES, CUSTOM_RAIDS, CUSTOM_CHARACTERS].forEach(v => assert.ok(Array.isArray(v)));
});

test('絵のあるモンスターは全部マスターに基礎ステータスがある', () => {
  ENEMIES.forEach(e => {
    const m = enemyMasterById(e.id);
    assert.ok(m, `${e.id} のマスターが無い`);
    const shape = enemyFormOf(e.id, 0);
    assert.ok(shape.hp > 0 && shape.atk > 0, `${e.id} の基礎ステータスが0`);
  });
});

test('倍率はHPと攻撃力にかかり、行動パターンは複製される', () => {
  const base = enemyFormOf('worm', 0);
  const half = spawnEnemy({ id: 'worm', mult: 0.5 });
  assert.equal(half.hp, Math.round(base.hp * 0.5));
  assert.equal(half.atk, Math.round(base.atk * 0.5));

  const skewed = spawnEnemy({ id: 'worm', mult: { hp: 2, atk: 0.25 } });
  assert.equal(skewed.hp, base.hp * 2);
  assert.equal(skewed.atk, Math.round(base.atk * 0.25));

  // 戦闘中に書き換えても、マスターや他のフロアへ漏れないこと
  const a = spawnEnemy({ id: 'worm' });
  const b = spawnEnemy({ id: 'worm' });
  a.enemySkills.preemptive.effects[0].turns = 99;
  assert.notEqual(b.enemySkills.preemptive.effects[0].turns, 99);
  assert.notEqual(ENEMY_MASTER.worm.enemySkills.preemptive.effects[0].turns, 99);
});

test('変身するボスは姿ごとに別のステータスと台詞を持つ', () => {
  assert.equal(formCountOf('kyuko'), 2);
  assert.equal(formCountOf('worm'), 1);
  const before = enemyFormOf('kyuko', 0);
  const after = enemyFormOf('kyuko', 1);
  assert.equal(before.name, 'キュウコ');
  assert.equal(after.name, '九尾の幻姫・キュウコ');
  assert.ok(after.hp > before.hp, '変身後のほうがHPが高いはず');
  assert.equal(after.id, 'kyuko_evolved', 'バトル側が別IDで見分けている');
  // 範囲外の form を渡しても落ちない(管理者ツールの入力ミス対策)
  assert.equal(enemyFormOf('kyuko', 99).name, before.name);
});

test('管理者ツールによる既存敵の改名・ボス化は通常抽選にも反映される', () => {
  const builtins = [
    { id: 'first', name: '旧名', sprite: 'old.webp' },
    { id: 'second', name: '通常敵', sprite: 'second.webp' }
  ];
  const custom = [
    { id: 'first', name: '新名', sprite: 'new.webp' },
    { id: 'second', boss: true, sprite: 'boss.webp' },
    { id: 'third', name: '追加敵', sprite: 'third.webp' }
  ];
  assert.deepEqual(buildEnemyPool(builtins, custom), [
    { id: 'first', name: '新名', sprite: 'new.webp' },
    { id: 'third', name: '追加敵', sprite: 'third.webp' }
  ]);
});

test('新しい5体は固有のWebP画像と固有の特殊行動を持つ', () => {
  const ids = ['glyphowl', 'umbrastag', 'chronosnail', 'mirrorjelly', 'arcanacauldron'];
  const effects = new Set();
  ids.forEach(id => {
    const shape = enemyFormOf(id);
    assert.ok(shape && shape.name && shape.enemySkills, `${id} のマスターが未登録`);
    const file = fileURLToPath(new URL(`../${shape.sprite}`, import.meta.url));
    const header = readFileSync(file).subarray(0, 12);
    assert.equal(header.toString('ascii', 0, 4), 'RIFF');
    assert.equal(header.toString('ascii', 8, 12), 'WEBP');
    effects.add(shape.enemySkills.preemptive.effects[0].type);
  });
  assert.equal(effects.size, ids.length, '新しい敵の先制技が重複している');
});

test('ボスは通常系ダンジョンの自動抽選から除外され、明示配置はできる', () => {
  const bosses = Object.keys(ENEMY_MASTER).filter(isBossEnemy);
  assert.ok(bosses.includes('kyuko'));
  assert.ok(bosses.includes('lilim_noctia'));
  bosses.forEach(id => {
    assert.ok(!ENEMIES.some(enemy => enemy.id === id), `${id} が通常抽選に混ざっている`);
    assert.ok(spawnEnemy({ id }), `${id} を降臨・ボスラッシュへ明示配置できない`);
  });
  assert.equal(enemyFormOf('kyuko', 0).boss, true);
  assert.equal(spawnEnemy({ id: 'kyuko' }).boss, true);
});

test('ノーマル・テクニカル・曜日の生成済みフロアにもボスがいない', async () => {
  const { STAGES, TECHNICAL_STAGES, dailyStagesFor } = await import('../src/js/data/gamedata.js');
  const groups = [STAGES, TECHNICAL_STAGES, ...Array.from({ length: 7 }, (_, day) => dailyStagesFor(day))];
  groups.flat().forEach(stage => (stage.floors || []).forEach(floor => {
    assert.equal(isBossEnemy(floor.enemyId), false,
      `${stage.name} にボス ${floor.enemyId} が自動配置されている`);
  }));
});

test('特殊ダンジョンの出現表は固定され、技は敵マスターと一致する', async () => {
  const { TECHNICAL_STAGES, TECH_ENCOUNTER_IDS, DAILY_ENCOUNTER_IDS, dailyStagesFor } =
    await import('../src/js/data/gamedata.js');
  TECHNICAL_STAGES.forEach((stage, stageIndex) => {
    stage.floors.forEach((floor, floorIndex) => {
      const chapter = Math.floor(stageIndex / 5);
      const withinChapter = stageIndex % 5;
      assert.equal(floor.enemyId, TECH_ENCOUNTER_IDS[chapter][(withinChapter + floorIndex) % 5]);
      assert.ok(floor.enemySkills, `${floor.enemyId} に特殊行動が無い`);
      assert.deepEqual(floor.enemySkills, enemyFormOf(floor.enemyId).enemySkills);
      assert.equal(floor.interval, enemyFormOf(floor.enemyId).interval);
      assert.notStrictEqual(floor.enemySkills, enemyFormOf(floor.enemyId).enemySkills);
    });
  });
  for (let day = 0; day < 7; day++) {
    for (const stage of dailyStagesFor(day)) {
      assert.deepEqual(stage.floors.map(floor => floor.enemyId), DAILY_ENCOUNTER_IDS[day]);
      stage.floors.forEach(floor => {
        assert.deepEqual(floor.enemySkills, enemyFormOf(floor.enemyId).enemySkills);
        assert.equal(floor.interval, enemyFormOf(floor.enemyId).interval);
      });
    }
  }
});

test('九狐降臨は5フロアで、ボスの2フロアが変身前後になっている', () => {
  assert.equal(KYUKO_RAID.floors.length, 5);
  const [b1, b2] = KYUKO_RAID.floors.slice(-2);
  assert.equal(b1.intro, 'warning');
  assert.equal(b2.intro, 'evolution');
  assert.equal(b1.enemies[0].hp, 18000);
  assert.equal(b2.enemies[0].hp, 26000);
  assert.ok(b1.dialogue && b2.dialogue);
  assert.ok(RAID_STAGES.includes(KYUKO_RAID));
});

test('知らないモンスターIDは落ちずに無視される', () => {
  assert.equal(spawnEnemy({ id: 'nope' }), null);
  assert.equal(enemyFormOf('nope'), null);
  assert.equal(enemyMasterById('nope'), null);
});

/* ===================== ホームのバナー ===================== */
import { homeBanners, BANNER_INTERVAL } from '../src/js/data/banners.js';
import { CUSTOM_SETTINGS } from '../src/js/data/custom.js';
import { PICKUP_CHARACTER, PICKUP_RATE } from '../src/js/data/gamedata.js';
import { isAvailable } from '../src/js/data/availability.js';

test('ホームのバナーは、いちばん新しい降臨のぶんだけ並ぶ', () => {
  const list = homeBanners();
  const raidOnes = list.filter(b => b.key.startsWith('raid-'));
  assert.equal(raidOnes.length, 1, '降臨のバナーは常に1枚(新しいものと差し替わる)');
  const newest = RAID_STAGES.filter(s => s.raid && isAvailable(s)).at(-1);
  assert.equal(raidOnes[0].key, `raid-${newest.id}`);
  assert.equal(raidOnes[0].screen, 'dungeon');
  assert.deepEqual(raidOnes[0].params, { mode: 'raid' });
});

test('バナーは飛び先と画像を必ず持つ(枠だけ出さない)', () => {
  homeBanners().forEach(b => {
    assert.ok(b.image, `${b.key} に画像が無い`);
    assert.ok(b.screen, `${b.key} に飛び先が無い`);
    assert.ok(b.alt, `${b.key} に読み上げ用の説明が無い`);
  });
  assert.ok(BANNER_INTERVAL >= 2000, '切り替えが速すぎると読めない');
});

test('ガチャのバナーは、設定されていて かつ ピックアップがいるときだけ出す', () => {
  const list = homeBanners();
  const gacha = list.filter(b => b.key.startsWith('gacha-'));
  const expected = CUSTOM_SETTINGS.gachaBanner && PICKUP_CHARACTER ? 1 : 0;
  assert.equal(gacha.length, expected);
});

test('ピックアップは管理ツールの設定を優先し、無ければ featured 印', () => {
  if (CUSTOM_SETTINGS.pickupOff) {
    assert.equal(PICKUP_CHARACTER, null, '開催しない設定なのにピックアップがいる');
  } else if (CUSTOM_SETTINGS.pickupId) {
    assert.equal(PICKUP_CHARACTER.id, CUSTOM_SETTINGS.pickupId);
  } else {
    assert.ok(PICKUP_CHARACTER === null || PICKUP_CHARACTER.featured);
  }
  assert.ok(PICKUP_RATE >= 0 && PICKUP_RATE <= 1, 'ピックアップ率が 0〜1 に収まっていない');
});

test('「ピックアップなし」は空文字ではなく pickupOff で表す', async () => {
  /* 空文字だと「未設定」と区別が付かず、既定の featured キャラへ戻ってしまう。
     管理ツールの「ピックアップなし」が黙って効かなくなるので、専用のキーを使う。
     実際の振る舞いは scripts/check-gacha-pu.cjs が本物の画面で確かめている。 */
  const { readFile } = await import('node:fs/promises');
  const chars = await readFile(new URL('../src/js/data/characters.js', import.meta.url), 'utf8');
  assert.ok(chars.includes('CUSTOM_SETTINGS.pickupOff'),
    'characters.js が pickupOff を見ていない');

  const tool = await readFile(new URL('../admin/js/views/gacha.js', import.meta.url), 'utf8');
  assert.ok(tool.includes("setSetting('pickupOff', true)"),
    '管理ツールが「なし」を pickupOff で保存していない');
  assert.ok(!/setSetting\('pickupId',\s*v\.pickupId\s*\|\|\s*''\)/.test(tool),
    '空文字で「なし」を表そうとしている(既定へ戻ってしまう)');
});


/* ===================== オフライン用の先読み ===================== */
import { readFile } from 'node:fs/promises';

test('main.js から辿れるモジュールは全部 sw.js の先読みに入っている', async () => {
  // 1つでも漏れるとオフライン起動が import エラーで死ぬ。
  // データ層を足したときに入れ忘れやすいので、ここで見張る。
  const root = new URL('../', import.meta.url);
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/(src\/js\/[^']+)'/g)].map(m => m[1]));

  const seen = new Set();
  async function walk(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const text = await readFile(new URL(path, root), 'utf8');
    for (const m of text.matchAll(/from\s+'(\.[^']+)'/g)) {
      const parts = path.split('/').slice(0, -1);
      for (const part of m[1].split('/')) {
        if (part === '.') continue;
        else if (part === '..') parts.pop();
        else parts.push(part);
      }
      await walk(parts.join('/'));
    }
  }
  await walk('src/js/main.js');

  const missing = [...seen].filter(p => !listed.has(p));
  assert.deepEqual(missing, [], `sw.js の ASSETS に足りない: ${missing.join(', ')}`);
});

/* ===================== 足したスキル ===================== */
import { CUSTOM_SKILLS, CUSTOM_LEADER_SKILLS } from '../src/js/data/custom.js';
import { LEADER_SKILLS, ACTIVE_SKILLS } from '../src/js/data/skills.js';

test('custom.js のスキルは5つのキーを必ず配列/オブジェクトで持つ', () => {
  [CUSTOM_SKILLS, CUSTOM_LEADER_SKILLS].forEach(v => assert.ok(Array.isArray(v)));
});

test('足したスキルは本体のスキル表に合流している', () => {
  CUSTOM_LEADER_SKILLS.forEach(s => {
    assert.ok(LEADER_SKILLS[s.id], `${s.id} が合流していない`);
    assert.ok(LEADER_SKILLS[s.id].desc, `${s.id} に説明が無い`);
  });
  CUSTOM_SKILLS.forEach(s => {
    assert.ok(ACTIVE_SKILLS[s.id], `${s.id} が合流していない`);
    assert.ok(ACTIVE_SKILLS[s.id].desc, `${s.id} に説明が無い`);
    assert.ok(ACTIVE_SKILLS[s.id].cooldown > 0, `${s.id} のCTが0`);
  });
});

test('敵の行動は「攻撃」と「特殊行動」を同時に持てる', async () => {
  // キュウコの進化後が元からこの形。管理ツールもこれを作れないといけない
  const { enemyFormOf } = await import('../src/js/data/enemy-master.js');
  const boss = enemyFormOf('kyuko', 1);
  const both = (boss.enemySkills.actions || []).filter(a => a.attack && a.effects && a.effects.length);
  assert.ok(both.length > 0, '攻撃しながら効果も撃つ行動が1つも無い');
  both.forEach(a => {
    a.effects.forEach(ef => assert.ok(ef.type, '効果に type が無い'));
  });
});
