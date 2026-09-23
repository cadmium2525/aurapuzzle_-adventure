import test from 'node:test';
import assert from 'node:assert/strict';
import {bossWarningText} from '../src/js/battle/raid-presentation.js';
import {RAID_STAGES} from '../src/js/data/raids.js';

test('boss warning uses the incoming floor master, not the previous raid boss',()=>{
  const lilim=RAID_STAGES.find(stage=>stage.id===2002).floors.find(f=>f.intro==='warning');
  assert.equal(bossWarningText(lilim),'強大な気配が迫る…… 夢魔の女帝 リリム=ノクティア、出現！');
  assert.doesNotMatch(bossWarningText(lilim),/九狐|キュウコ/);
  const kyuko=RAID_STAGES.find(stage=>stage.id===2001).floors.find(f=>f.intro==='warning');
  assert.match(bossWarningText(kyuko),/キュウコ、出現！/);
});

test('future bosses and missing names have safe warning text',()=>{
  assert.equal(bossWarningText({enemies:[{name:'新ボス'}]}),'強大な気配が迫る…… 新ボス、出現！');
  assert.equal(bossWarningText({enemies:[]}),'強大な気配が迫る……');
});
