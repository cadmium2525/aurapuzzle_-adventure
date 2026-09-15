import { createEnemyEffects, enterEnemy, tickEnemyEffects } from './enemy-skills.js';

export const combatEnemy = run => run.actingEnemy || run.enemies[run.targetIndex] || run.enemies[0];
export const encounterCleared = run => run.enemies.every(e=>e.hp<=0);
export function retarget(run) {
  if(!run.enemies[run.targetIndex] || run.enemies[run.targetIndex].hp<=0)run.targetIndex=Math.max(0,run.enemies.findIndex(e=>e.hp>0));
}
export function attachEncounter(run) {
  for(const [alias,key] of Object.entries({enemyHP:'hp',enemyMaxHP:'maxHP',enemyAtk:'atk',enemyInterval:'interval',enemyTurnsLeft:'turnsLeft',enemyActionIndex:'actionIndex'})) {
    Object.defineProperty(run,alias,{enumerable:true,get:()=>combatEnemy(run)[key],set:value=>{combatEnemy(run)[key]=value;}});
  }
  for(const key of ['defenses','resolve','attackMult']) {
    Object.defineProperty(run.enemyEffects,key,{enumerable:true,get:()=>combatEnemy(run).effects[key],set:value=>{combatEnemy(run).effects[key]=value;}});
  }
}
export function createEncounter(floor, multiplier=1) {
  return (floor.enemies || [floor]).map((spec,index)=>{
    const effects=createEnemyEffects(0);enterEnemy(effects,spec.enemySkills);
    return {spec,id:index,hp:Math.round(spec.hp*multiplier),maxHP:Math.round(spec.hp*multiplier),atk:Math.round(spec.atk*multiplier),
      interval:spec.interval,turnsLeft:spec.interval,actionIndex:0,effects,builtUp:false};
  });
}
export function tickEncounter(run) {
  const selected=combatEnemy(run);
  tickEnemyEffects(run.enemyEffects);
  for(const e of run.enemies)if(e!==selected)tickEnemyEffects(e.effects);
}
export function summonClones(run,owner) {
  if(owner.summoned)return;
  owner.summoned=true;
  const clones=[0,1].map((_,i)=>({spec:{...owner.spec,name:'キュウコの分身体',enemySkills:{}},id:run.enemies.length+i,
    hp:Math.round(owner.maxHP/2),maxHP:Math.round(owner.maxHP/2),atk:0,interval:Infinity,turnsLeft:Infinity,actionIndex:0,effects:createEnemyEffects(0),cloneOf:owner.id}));
  run.enemies.push(...clones);
}
export function damageTarget(run) {
  const target=combatEnemy(run);
  return run.enemies.find(e=>e.cloneOf===target.id && e.hp>0) || target;
}
