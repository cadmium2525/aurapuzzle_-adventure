import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_MASTER, enemyMasterById, enemyFormOf, formCountOf, spawnEnemy
} from '../src/js/data/enemy-master.js';
import { ENEMIES } from '../src/js/data/enemies.js';
import { KYUKO_RAID, RAID_STAGES } from '../src/js/data/raids.js';
import { CUSTOM_ENEMIES, CUSTOM_RAIDS, CUSTOM_CHARACTERS } from '../src/js/data/custom.js';

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

test('九狐降臨は10フロアで、ボスの2フロアが変身前後になっている', () => {
  assert.equal(KYUKO_RAID.floors.length, 10);
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
