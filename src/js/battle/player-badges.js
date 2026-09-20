import { toast } from '../core/ui.js';

export const BADGE_ORDER = ['timeReduce','timeFixed','timeExtend','bind','auraBind','attack','guard','skillDelay','poison'];
const AURAS=['火','水','木','癒','闇'];
const COLORS=['#ff795b','#58d7ff','#66eca2','#ff94d2','#b28aff'];

export function playerStatuses(run) {
  const global=[], units=run.party.members.map(()=>[]);
  const time=run.enemyEffects.time;
  const recovery=run.enemyEffects.recovery;
  const poison=run.enemyEffects.poison;
  if(recovery)global.push({type:'recoveryReduce',turns:recovery.turns,label:`味方全体の回復力${recovery.percent}%減少（癒オーラによる回復が対象。最大HP割合の回復スキルは影響なし）`});
  if(poison)global.push({type:'poison',turns:poison.turns,label:`毒：手番終了時に最大HPの${poison.percent}%ダメージ（軽減不可）`});
  if(time)global.push({type:time.type,turns:time.turns,label:`操作時間${time.type==='timeFixed'?`${time.seconds}秒固定`:`${time.seconds}秒減少`}`});
  if(run.turnTimeBonusMs>0)global.push({type:'timeExtend',turns:1,label:`操作時間${run.turnTimeBonusMs/1000}秒延長${time?.type==='timeFixed'?'（固定中は延長無効）':''}`});
  for(const [aura,turns] of Object.entries(run.enemyEffects.auraBinds))global.push({type:'auraBind',aura:Number(aura),turns,label:`${AURAS[aura]}オーラ消去不可`});
  if(run.buffs.atk)global.push({type:'attack',turns:run.buffs.atk.turns,label:`味方全体の攻撃力${run.buffs.atk.mult}倍`});
  if(run.buffs.guard)global.push({type:'guard',turns:run.buffs.guard.turns,label:`味方全体の被ダメージ${Math.round(run.buffs.guard.rate*100)}%軽減`});
  units.forEach((list,i)=>{
    if(run.enemyEffects.binds[i])list.push({type:'bind',turns:run.enemyEffects.binds[i],label:`${run.party.members[i].name}：バインド中（攻撃・回復・スキル使用不可）`});
    if(run.skillDelayDebt?.[i]>0)list.push({type:'skillDelay',turns:run.skillDelayDebt[i],label:`${run.party.members[i].name}：スキル遅延分あと${run.skillDelayDebt[i]}ターン・使用可能まで合計${run.cooldowns[i]}ターン`});
  });
  return {global,units};
}

function render(root,entries) {
  if(!root)return;
  const signature=JSON.stringify(entries);
  if(root.dataset.signature===signature)return;
  root.dataset.signature=signature;root.replaceChildren();
  for(const entry of entries){
    // Individual icons are siblings of the skill button, never nested interactive elements.
    const button=document.createElement('button');button.type='button';button.className='player-badge';
    button.dataset.effect=entry.type;
    button.style.setProperty('--status-index',BADGE_ORDER.indexOf(entry.type));
    const description=entry.label+(entry.type==='skillDelay'?'':Number.isFinite(entry.turns)?`（残り${entry.turns}ターン）`:'');
    button.title=description;button.setAttribute('aria-label',description);
    const art=document.createElement('span');art.className='player-badge-art';art.setAttribute('aria-hidden','true');button.appendChild(art);
    if(Number.isFinite(entry.turns)){const n=document.createElement('span');n.className='enemy-badge-turns';n.textContent=entry.turns;button.appendChild(n);}
    if(entry.aura!==undefined){const aura=document.createElement('span');aura.className='enemy-badge-aura';aura.style.background=COLORS[entry.aura];aura.textContent=AURAS[entry.aura];button.appendChild(aura);}
    button.addEventListener('click',e=>{e.stopPropagation();toast(description);});
    root.appendChild(button);
  }
}

export function renderPlayerBadges(run) {
  const statuses=playerStatuses(run);
  render(document.getElementById('playerEffects'),statuses.global);
  document.querySelectorAll('#partyRow .unit-statuses').forEach((root,i)=>render(root,statuses.units[i]||[]));
}
