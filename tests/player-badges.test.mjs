import test from 'node:test';
import assert from 'node:assert/strict';
import { playerStatuses, BADGE_ORDER } from '../src/js/battle/player-badges.js';
const run=()=>({party:{members:[{name:'味方A'},{name:'味方B'}]},enemyEffects:{binds:[0,0],auraBinds:{},time:null,recovery:null,poison:null},buffs:{},cooldowns:[5,0],turnTimeBonusMs:0});
test('player icons describe debuffs, durations and per-character targets',()=>{
  const r=run();r.enemyEffects={binds:[2,0],auraBinds:{2:5},time:{type:'timeReduce',seconds:3,turns:5}};r.skillDelayDebt=[1,0];
  const s=playerStatuses(r);
  assert.deepEqual(s.global.map(e=>e.type),['timeReduce','auraBind']);
  assert.match(s.global[0].label,/3秒減少/);assert.equal(s.global[1].aura,2);
  assert.deepEqual(s.units[0].map(e=>e.type),['bind','skillDelay']);assert.deepEqual(s.units[1],[]);
  assert.match(s.units[0][1].label,/合計5ターン/);
});
test('buffs and fixed-time override are accurately described and removed when expired',()=>{
  const r=run();r.enemyEffects.time={type:'timeFixed',seconds:5,turns:3};r.turnTimeBonusMs=3000;r.buffs={atk:{mult:1.5,turns:2},guard:{rate:.5,turns:3}};
  const s=playerStatuses(r);assert.match(s.global[1].label,/延長無効/);
  assert.deepEqual(s.global.map(e=>e.type),['timeFixed','timeExtend','attack','guard']);
  assert.ok(s.global.every(e=>BADGE_ORDER.includes(e.type)));
  assert.deepEqual(playerStatuses(run()),{global:[],units:[[],[]]});
});
test('poison badge shows max-HP damage and remaining turns',()=>{
  const r=run();r.enemyEffects.poison={type:'poison',percent:8,turns:3};
  const status=playerStatuses(r).global[0];
  assert.equal(status.type,'poison');assert.equal(status.turns,3);
  assert.match(status.label,/最大HPの8%/);assert.ok(BADGE_ORDER.includes('poison'));
});
