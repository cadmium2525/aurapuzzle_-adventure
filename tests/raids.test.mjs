import test from 'node:test';
import assert from 'node:assert/strict';
import {KYUKO_RAID,raidDropRate,rollRaidCharacter} from '../src/js/data/raids.js';
import {createEncounter,attachEncounter,combatEnemy,damageTarget,summonClones,encounterCleared,tickEncounter,retarget} from '../src/js/battle/encounter.js';
import {createEnemyEffects,applyEnemyEffect,damageEnemy} from '../src/js/battle/enemy-skills.js';
import {resolveCharacter,characterById,awakenMaxFor,awakenCopiesFor,finalStarOf} from '../src/js/data/characters.js';
import {GACHA_POOL} from '../src/js/data/gamedata.js';

const battle=floor=>{const run={enemies:createEncounter(floor),targetIndex:0,enemyEffects:createEnemyEffects(4)};attachEncounter(run);return run;};
test('raid has exactly the requested ten formations',()=>{
  assert.deepEqual(KYUKO_RAID.floors.map(f=>f.enemies.map(e=>e.id)),[
    ['monolith','monolith','monolith'],['worm','worm'],['monolith','gia','gorem'],['raiga','raiga'],['kongou'],
    ['raiga','raiga'],['gorem','worm'],['gia','monolith','gia'],['kyuko'],['kyuko_evolved']]);
});
test('enemy defenses are independent, player binds shared, turn expiry applies to all foes',()=>{
  const run=battle(KYUKO_RAID.floors[2]);
  run.actingEnemy=run.enemies[0];applyEnemyEffect(run.enemyEffects,{type:'comboGuard',chains:5,turns:2},[]);
  run.actingEnemy=run.enemies[1];applyEnemyEffect(run.enemyEffects,{type:'bind',count:4,turns:2},[]);
  assert.equal(run.enemyEffects.defenses.length,0);
  run.actingEnemy=null;tickEncounter(run);
  assert.equal(run.enemies[0].effects.defenses[0].turns,1);
  assert.deepEqual(run.enemyEffects.binds,[1,1,1,1]);
  run.enemyHP=0;assert.equal(encounterCleared(run),false);retarget(run);assert.equal(combatEnemy(run),run.enemies[1]);
});
test('two clones shield boss, each has half HP, no overkill transfers to boss',()=>{
  const run=battle(KYUKO_RAID.floors[9]),boss=run.enemies[0];
  summonClones(run,boss);summonClones(run,boss);assert.equal(run.enemies.length,3);
  for(const clone of run.enemies.slice(1)){
    assert.equal(clone.hp,boss.maxHP/2);assert.equal(damageTarget(run),clone);
    clone.hp=damageEnemy({hp:clone.hp,maxHP:clone.maxHP,effects:clone.effects,hits:[{aura:0,value:999999}],chain:6}).hp;
    assert.equal(boss.hp,boss.maxHP);
  }
  assert.equal(damageTarget(run),boss);
});
test('Kyuko evolves and raid awaken caps/costs differ from normal characters; never in gacha',()=>{
  const base=characterById('dk_kyuko');assert.equal(finalStarOf(base),4);
  assert.equal(awakenMaxFor(base),10);assert.equal(awakenMaxFor(characterById('fl_rito')),4);
  assert.deepEqual(Array.from({length:10},(_,i)=>awakenCopiesFor(base,i)),[1,2,3,5,8,12,18,25,35,50]);
  const evolved=resolveCharacter(base,4,40,10);assert.equal(evolved.awaken,10);assert.equal(evolved.skill.name,'九重の狐火');
  assert.equal(GACHA_POOL.some(c=>c.id===base.id),false);
  assert.equal(raidDropRate(KYUKO_RAID,[]),.5);
  assert.ok(Math.abs(raidDropRate(KYUKO_RAID,[evolved])-.7)<1e-9);
  assert.equal(raidDropRate(KYUKO_RAID,[evolved,evolved,evolved]),1);
  assert.equal(rollRaidCharacter(KYUKO_RAID,[],()=>.499),'dk_kyuko');
  assert.equal(rollRaidCharacter(KYUKO_RAID,[],()=>.5),null);
  assert.equal(rollRaidCharacter(KYUKO_RAID,[evolved],()=>.69),'dk_kyuko');
  assert.equal(rollRaidCharacter(KYUKO_RAID,[evolved],()=>.71),null);
});
