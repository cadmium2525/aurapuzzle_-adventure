import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyEffects, enterEnemy, applyEnemyEffect, tickEnemyEffects, effectiveTime, damageEnemy, matchesShape, enemyAction, poisonDamage, effectLabels } from '../src/js/battle/enemy-skills.js';

const hit = (effects, options = {}) => damageEnemy({ hp: 100, maxHP: 100, effects, hits: [{ aura: 0, value: 150 }], ...options });
test('bind selects distinct members, lasts full turns and persists across floors', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'bind', count: 2, turns: 2 }, [], () => 0);
  assert.equal(s.binds.filter(n => n === 2).length, 2);
  tickEnemyEffects(s);
  enterEnemy(s);
  assert.equal(s.binds.filter(n => n === 1).length, 2);
  tickEnemyEffects(s);
  assert.deepEqual(s.binds, [0,0,0,0]);
});
test('delay affects distinct targets and clamps target count to party size', () => {
  const s = createEnemyEffects(4), cd = [0,1,2,3];
  applyEnemyEffect(s, { type: 'skillDelay', count: 9, turns: 3 }, cd);
  assert.deepEqual(cd, [3,4,5,6]);
});
test('combo guard uses final chains with inclusive threshold, including direct skill damage', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'comboGuard', chains: 3 }, []);
  assert.equal(hit(s, { chain: 3 }).hp, 100);
  assert.equal(hit(s, { chain: 4 }).hp, 0);
  assert.equal(hit(s).blocked, true);
});
test('shape guard ignores aura, requires the exact group, permits rotation and translation', () => {
  const s = createEnemyEffects(4);
  const cells = [[3,2],[3,3],[3,4],[4,2],[5,2]];
  applyEnemyEffect(s, { type: 'shapeGuard', shape: 'L' }, []);
  // 形さえ合っていればどのオーラでも通る(オーラ指定は外した)
  assert.equal(hit(s, { groups: [{ color: 1, cells }] }).hp, 0);
  assert.equal(hit(s, { groups: [{ color: 0, cells }] }).hp, 0);
  // 形が違えば通らない
  assert.equal(hit(s, { groups: [{ color: 0, cells: [[0,0],[0,1],[1,0],[1,1]] }] }).blocked, true);
  assert.equal(matchesShape([...cells,[4,3]], { shape: 'L' }), false);
  assert.equal(matchesShape(cells, { shape: 'L', rotate: false }), false);
});
test('aura bind expires after the last affected player turn', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'auraBind', aura: 3, turns: 1 }, []);
  assert.equal(s.auraBinds[3], 1);
  tickEnemyEffects(s);
  assert.equal(s.auraBinds[3], undefined);
});
test('time reduction allows bonus, fixed time ignores bonus and expiry restores time', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'timeReduce', seconds: 3, turns: 2 }, []);
  assert.equal(effectiveTime(10000, 2000, 20000, s), 9000);
  applyEnemyEffect(s, { type: 'timeFixed', seconds: 4, turns: 1 }, []);
  assert.equal(effectiveTime(10000, 5000, 20000, s), 4000);
  tickEnemyEffects(s);
  assert.equal(effectiveTime(10000, 5000, 20000, s), 15000);
});
test('poison deals max-HP damage for exactly the configured number of turns', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'poison', percent: 8, turns: 3 }, []);
  assert.equal(poisonDamage(s, 1250), 100);
  assert.match(effectLabels(s).join(''), /最大HPの8%/);
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(poisonDamage(s, 1250), 100);
    tickEnemyEffects(s);
  }
  assert.equal(poisonDamage(s, 1250), 0);
  assert.equal(s.poison, null);
});
test('poison percentage is clamped and ignores ordinary damage reduction inputs', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'poison', percent: 999, turns: 1 }, []);
  s.attackMult = 2;
  assert.equal(poisonDamage(s, 777), 777);
});
test('absorption combines all aura damage before HP update and respects maximum HP', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'auraAbsorb', aura: 0, turns: 2 }, []);
  const hits = [{ aura: 0, value: 80 }, { aura: 1, value: 50 }];
  assert.equal(hit(s, { hp: 40, hits }).hp, 70);
  assert.equal(hit(s, { hp: 40, hits: hits.toReversed() }).hp, 70);
  assert.equal(hit(s).hp, 100);
});
test('two aura absorptions on one enemy stay active independently', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'auraAbsorb', aura: 1, turns: 3 }, []);
  applyEnemyEffect(s, { type: 'auraAbsorb', aura: 4, turns: 3 }, []);
  assert.deepEqual(s.defenses.map(d => d.aura), [1, 4]);
  assert.equal(hit(s, { hp: 50, hits: [
    { aura: 1, value: 20 }, { aura: 4, value: 25 }, { aura: 0, value: 10 }
  ] }).hp, 85);
  for (let i = 0; i < 3; i++) tickEnemyEffects(s);
  assert.equal(s.defenses.length, 0);
});
test('build up does not stack, enemy effects reset on next floor', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'buildUp' }, []);
  applyEnemyEffect(s, { type: 'buildUp' }, []);
  assert.equal(s.attackMult, 2);
  enterEnemy(s, { passives: [{ type: 'comboGuard', chains: 2 }] });
  assert.equal(s.attackMult, 1);
  assert.equal(s.defenses.length, 1);
});
test('resolve survives exactly lethal damage then stays disabled, including after healing', () => {
  const s = createEnemyEffects(4);
  applyEnemyEffect(s, { type: 'resolve', threshold: 30 }, []);
  assert.equal(hit(s, { hits: [{ aura: 0, value: 100 }] }).hp, 1);
  assert.equal(hit(s).hp, 0);
  applyEnemyEffect(s, { type: 'resolve', threshold: 30 }, []);
  assert.equal(hit(s, { hp: 30 }).hp, 0);
});
test('normal enemies attack; configured actions cycle independently of preemptive', () => {
  assert.deepEqual(enemyAction(undefined, 0), { attack: true });
  const skills = { preemptive: { effects: [{ type: 'buildUp' }] }, actions: [{ attack: false }, { attack: true }] };
  assert.equal(enemyAction(skills, 0).attack, false);
  assert.equal(enemyAction(skills, 1).attack, true);
  assert.equal(enemyAction(skills, 2).attack, false);
});
