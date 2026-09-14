import test from 'node:test';
import assert from 'node:assert/strict';
import {baseActions,finalActions} from '../src/js/battle/damage.js';
const mods={rcv:1,allAtk:1,auraAtk:{},comboAtk:[]};
const run={party:{members:[{atk:100,rcv:100,aura:0},{atk:100,rcv:100,aura:1},{atk:100,rcv:100,aura:3}]},enemyEffects:{binds:[0,0,0]},matchMin:4,mods,buffs:{}};
const group=(color,n=4)=>({color,cells:Array(n).fill([0,0])});
test('all attributes use final chain multiplier regardless of clearing order',()=>{
  const actions=[...baseActions([group(0)],run),...baseActions([group(1)],run)];
  assert.deepEqual(finalActions(actions,5,mods).map(a=>a.value),[340,340]);
  assert.equal(finalActions(actions,1,mods)[0].value,100);
});
test('final chain leader condition applies to early attacks too; healing uses final chain',()=>{
  const actions=baseActions([group(0),group(3)],run);
  const result=finalActions(actions,3,{...mods,comboAtk:[{combo:3,mult:2}]});
  assert.equal(result[0].value,462);
  assert.equal(result[1].value,528);
});
test('same-color groups retain combined count and simultaneous bonus; bind prevents action',()=>{
  assert.equal(baseActions([group(0),group(0)],run)[0].value,252);
  assert.equal(baseActions([group(0)],{...run,enemyEffects:{binds:[1,0,0]}}).length,0);
});
test('representative uniform chains remain below previous x3 per-wave damage',()=>{
  for(const n of [1,3,5,10,14]){
    const next=finalActions([{kind:'dmg',value:100*n}],n,mods)[0].value;
    const old=Array.from({length:n},(_,i)=>300*(1+i*.6)).reduce((a,b)=>a+b,0);
    assert.ok(next<old);
  }
});
