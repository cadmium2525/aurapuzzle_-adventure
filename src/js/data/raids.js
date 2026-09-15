import { enemyById } from './enemies.js';

const guard = turns => ({type:'comboGuard',chains:5,...(turns ? {turns} : {})});
const attack = {attack:true};
const MONSTERS = {
  monolith:{hp:4200,atk:90,interval:2,enemySkills:{preemptive:{effects:[guard(5)]}}},
  worm:{hp:4800,atk:110,interval:2,enemySkills:{preemptive:{effects:[{type:'auraAbsorb',aura:2,turns:5}]}}},
  gia:{hp:4600,atk:100,interval:2,enemySkills:{preemptive:{effects:[{type:'timeReduce',seconds:2,turns:1}]},random:true,actions:[attack,{effects:[{type:'timeReduce',seconds:2,turns:1}]}]}},
  gorem:{hp:6200,atk:105,interval:2,enemySkills:{preemptive:{effects:[{type:'resolve',threshold:50}]},buildUpBelow:50}},
  raiga:{hp:4000,atk:85,interval:1,enemySkills:{preemptive:{effects:[{type:'bind',count:1,turns:2}]}}},
  kongou:{hp:14500,atk:160,interval:2,enemySkills:{preemptive:{effects:[{type:'timeFixed',seconds:5,turns:3},guard(3)]}}}
};
const monster = id => ({...enemyById(id),emoji:'👹',...structuredClone(MONSTERS[id])});
const boss = evolved => ({
  id:evolved?'kyuko_evolved':'kyuko', name:evolved?'九尾の幻姫・キュウコ':'キュウコ',
  sprite:`assets/chars/kyuko_${evolved?2:1}.webp`,emoji:'🦊',
  hp:evolved?26000:18000,atk:evolved?145:120,interval:1,
  enemySkills:evolved?{
    preemptive:{effects:[guard(),{type:'resolve',threshold:50},{type:'summonClones'}]},
    random:true,actions:[
      {attack:true,effects:[{type:'skillDelay',count:2,turns:1}],dialogue:'その術、もう少し待っていてくださる？'},
      {attack:true,effects:[{type:'bind',count:1,turns:2}],dialogue:'動かないで。あなたの影を、わたくしに頂戴。'},
      {attack:true,effects:[{type:'auraBind',aura:2,turns:2}],dialogue:'緑の灯は、しばし夢の中へ。'},
      {attack:true,effects:[{type:'auraBind',aura:1,turns:1}],dialogue:'水面に映るものが、本当のあなたかしら？'}
    ]
  }:{
    preemptive:{effects:[{type:'skillDelay',count:4,turns:1},{type:'timeReduce',seconds:3,turns:5}]},
    random:true,actions:[
      {attack:true,dialogue:'ふふ、見惚れていたの？ 隙だらけよ。'},
      {attack:true,dialogue:'こちらへおいで。……あら、そちらはわたくしの影。'},
      {attack:true,dialogue:'もう帰るだなんて言わないで。遊びはこれからでしょう？'}
    ]
  }
});
const floor = ids => ({enemies:ids.map(monster)});
export const KYUKO_RAID = {
  id:2001,raid:true,name:'九狐降臨',stamina:30,coinReward:9000,orbReward:0,expReward:180,charExpReward:600,
  auras:[0,1,2,3,4],dropAura:4,dropType:'raid',shardRate:.35,crystalBase:8,
  characterDrop:{id:'dk_kyuko',rate:.5},
  floors:[floor(['monolith','monolith','monolith']),floor(['worm','worm']),floor(['monolith','gia','gorem']),
    floor(['raiga','raiga']),floor(['kongou']),floor(['raiga','raiga']),floor(['gorem','worm']),floor(['gia','monolith','gia']),
    {enemies:[boss(false)],intro:'warning',dialogue:'こんな奥まで、わたくしを追いかけてきたの？ ふふ……いい子ね。少しだけ、遊んであげる。'},
    {enemies:[boss(true)],intro:'evolution',dialogue:'人の姿は、もうおしまい。九つの尾、九つのまやかし――さあ、本当のわたくしを見つけてごらんなさい。'}]
};
export const RAID_STAGES=[KYUKO_RAID];

/** Own raid members contribute percentage points, supports do not. */
export function raidDropRate(stage, own) {
  return Math.min(1, (stage.characterDrop?.rate || 0) + own.reduce((sum,m)=>sum+(m.awakenMods?.dropRate || 0),0));
}
export function rollRaidCharacter(stage, own, random=Math.random) {
  return stage.raid && random() < raidDropRate(stage,own) ? stage.characterDrop.id : null;
}
