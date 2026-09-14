import { COLORS, HEAL_COLOR, ATTACK_SCALE, HEAL_SCALE, ORB_BONUS, COMBO_BONUS, SIMUL_BONUS } from '../data/gamedata.js';

// Accumulate unrounded contributions; apply the final chain multiplier once.
export function baseActions(groups, run) {
  const counts = {};
  for (const g of groups) counts[g.color] = (counts[g.color] || 0) + g.cells.length;
  const actions = [];
  run.party.members.forEach((m,index) => {
    const n=counts[m.aura] || 0;
    if (!n || run.enemyEffects.binds[index]) return;
    const orbs=1+Math.max(0,n-run.matchMin)*ORB_BONUS;
    const heal=m.aura===HEAL_COLOR;
    const value=heal
      ? m.rcv*HEAL_SCALE*orbs*run.mods.rcv
      : m.atk*ATTACK_SCALE*orbs*(1+(groups.length-1)*SIMUL_BONUS)
        *run.mods.allAtk*(run.mods.auraAtk[COLORS[m.aura]] || 1)*(run.buffs.atk?.mult || 1);
    actions.push({index,aura:m.aura,kind:heal?'heal':'dmg',value});
  });
  return actions;
}

export function finalActions(actions, chains, mods) {
  const chainMult=1+Math.max(0,chains-1)*COMBO_BONUS;
  const leaderMult=mods.comboAtk.reduce((m,c)=>chains>=c.combo?m*c.mult:m,1);
  return [...actions].map(a=>({...a,value:Math.round(a.value*chainMult*(a.kind==='dmg'?leaderMult:1))}));
}
