import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnemyEffects, applyEnemyEffect, tickEnemyEffects, enterEnemy, recoveryMultiplier} from '../src/js/battle/enemy-skills.js';
import {baseActions, finalActions} from '../src/js/battle/damage.js';
import {playerStatuses} from '../src/js/battle/player-badges.js';
import {ENEMY_EFFECT_BY_TYPE, describeEffect} from '../admin/js/gamedata.js';
import {newEffect} from '../admin/js/views/effects.js';

test('recovery reduction lasts the specified turns and survives floor transitions', () => {
  const effects=createEnemyEffects(2);
  applyEnemyEffect(effects,{type:'recoveryReduce',percent:75,turns:999},[]);
  enterEnemy(effects);
  assert.equal(recoveryMultiplier(effects),.25);
  for(let n=0;n<998;n++)tickEnemyEffects(effects);
  assert.equal(effects.recovery.turns,1);
  tickEnemyEffects(effects);
  assert.equal(recoveryMultiplier(effects),1);
});

test('recovery reductions replace, do not multiply, and clamp at zero healing', () => {
  const effects=createEnemyEffects(2);
  for(const percent of [75,50,150]){
    applyEnemyEffect(effects,{type:'recoveryReduce',percent,turns:3},[]);
    assert.equal(recoveryMultiplier(effects),1-Math.min(percent,100)/100);
  }
});

test('recovery reduction affects healing with leader and final chain multipliers, not attacks', () => {
  const mods={rcv:2,allAtk:1,auraAtk:{},comboAtk:[]};
  const run={party:{members:[{atk:100,rcv:100,aura:0},{atk:100,rcv:100,aura:3}]},enemyEffects:createEnemyEffects(2),matchMin:4,mods,buffs:{}};
  const groups=[0,3].map(color=>({color,cells:Array(4).fill([0,0])}));
  const before=finalActions(baseActions(groups,run),3,mods);
  applyEnemyEffect(run.enemyEffects,{type:'recoveryReduce',percent:75,turns:999},[]);
  const after=finalActions(baseActions(groups,run),3,mods);
  assert.equal(after[0].value,before[0].value);
  assert.equal(after[1].value,before[1].value/4);
});

test('admin exposes percentage and 999-turn duration; badge follows expiry',()=>{
  assert.equal(ENEMY_EFFECT_BY_TYPE.recoveryReduce.args.find(a=>a.key==='turns').max,999);
  assert.deepEqual(newEffect('recoveryReduce'),{type:'recoveryReduce',percent:50,turns:3});
  const effect={type:'recoveryReduce',percent:75,turns:1};
  assert.match(describeEffect(effect),/75/);
  const run={party:{members:[]},enemyEffects:createEnemyEffects(0),buffs:{}};
  applyEnemyEffect(run.enemyEffects,effect,[]);
  assert.equal(playerStatuses(run).global[0].turns,1);
  assert.match(playerStatuses(run).global[0].label,/75%減少/);
  tickEnemyEffects(run.enemyEffects);
  assert.deepEqual(playerStatuses(run).global,[]);
});
