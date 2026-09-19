// Enemy effects count completed player turns. Apply new enemy effects after ticking.
export function createEnemyEffects(size) {
  return { binds: Array(size).fill(0), auraBinds: {}, time: null, recovery: null, defenses: [], attackMult: 1, resolve: null };
}

export function enterEnemy(effects, skills = {}) {
  effects.defenses = [];
  effects.attackMult = 1;
  effects.resolve = null;
  for (const effect of skills.passives || []) applyEnemyEffect(effects, effect, []);
}

export function applyEnemyEffect(s, effect, cooldowns, random = Math.random) {
  let affected = [];
  const turns = effect.turns ?? Infinity;
  const targets = () => {
    const pool = s.binds.map((_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.max(0, effect.count));
  };
  switch (effect.type) {
    case 'bind': affected = targets(); affected.forEach(i => { s.binds[i] = Math.max(s.binds[i], turns); }); break;
    case 'skillDelay': affected = targets(); affected.forEach(i => { cooldowns[i] += effect.turns; }); break;
    case 'auraBind': s.auraBinds[effect.aura] = Math.max(s.auraBinds[effect.aura] || 0, turns); break;
    case 'timeReduce': case 'timeFixed': s.time = { ...effect, turns }; break;
    case 'recoveryReduce': {
      const percent = Math.min(100, Math.max(0, Number(effect.percent) || 0));
      s.recovery = turns > 0 && percent > 0 ? { type: effect.type, percent, turns } : null;
      break;
    }
    case 'comboGuard': case 'shapeGuard': case 'auraAbsorb':
      s.defenses = s.defenses.filter(d => d.type !== effect.type || d.aura !== effect.aura);
      s.defenses.push({ ...effect, turns }); break;
    case 'buildUp': s.attackMult = 2; break;
    case 'resolve': s.resolve = { threshold: effect.threshold, active: true }; break;
    default: throw new Error(`Unknown enemy effect: ${effect.type}`);
  }
  return affected;
}

export function tickEnemyEffects(s) {
  s.binds = s.binds.map(n => Math.max(0, n - 1));
  for (const aura of Object.keys(s.auraBinds)) if (--s.auraBinds[aura] <= 0) delete s.auraBinds[aura];
  if (s.time && --s.time.turns <= 0) s.time = null;
  if (s.recovery && --s.recovery.turns <= 0) s.recovery = null;
  s.defenses = s.defenses.filter(d => --d.turns > 0);
}

export function effectiveTime(baseMs, bonusMs, maxMs, effects) {
  const time = effects.time;
  if (time?.type === 'timeFixed') return Math.max(100, time.seconds * 1000);
  return Math.max(100, Math.min(maxMs, baseMs + bonusMs) - (time?.seconds || 0) * 1000);
}

// Only RCV-based healing is reduced. Max-HP percentage skills do not use RCV.
export function recoveryMultiplier(effects) {
  return effects?.recovery?.turns > 0 ? 1 - effects.recovery.percent / 100 : 1;
}

export const SHAPES = {
  L: [[0,0],[1,0],[2,0],[2,1],[2,2]],
  cross: [[0,1],[1,0],[1,1],[1,2],[2,1]],
  square: [[0,0],[0,1],[1,0],[1,1]],
  line: [[0,0],[0,1],[0,2],[0,3]]
};
const normalize = cells => {
  const r = Math.min(...cells.map(p => p[0])), c = Math.min(...cells.map(p => p[1]));
  return cells.map(([y,x]) => `${y-r},${x-c}`).sort().join(';');
};
export function matchesShape(cells, rule) {
  let pattern = rule.cells || SHAPES[rule.shape];
  if (!pattern?.length) return false;
  // Exact connected-group shape, translated and optionally rotated. No reflection.
  for (let i = 0; i < (rule.rotate === false ? 1 : 4); i++) {
    if (normalize(cells) === normalize(pattern)) return true;
    pattern = pattern.map(([r,c]) => [c,-r]);
  }
  return false;
}

export function damageEnemy({ hp, maxHP, effects, hits, chain = 0, groups = [] }) {
  const blocked = effects.defenses.some(d =>
    (d.type === 'comboGuard' && chain <= d.chains) ||
    // 形ガードは「形」だけを見る。どのオーラで作ったかは問わない
    (d.type === 'shapeGuard' && !groups.some(g => matchesShape(g.cells, d))));
  if (blocked) return { hp, damage: 0, absorbed: 0, blocked: true, survived: false };
  let damage = 0, absorbed = 0;
  for (const hit of hits) {
    if (effects.defenses.some(d => d.type === 'auraAbsorb' && d.aura === hit.aura)) absorbed += hit.value;
    else damage += hit.value;
  }
  const resolve = effects.resolve;
  if (resolve && hp / maxHP * 100 <= resolve.threshold) resolve.active = false;
  let next = Math.min(maxHP, Math.max(0, hp - damage + absorbed));
  const survived = !!(resolve?.active && next <= 0 && hp > 0);
  if (survived) next = 1;
  if (resolve && next / maxHP * 100 <= resolve.threshold) resolve.active = false;
  return { hp: next, damage, absorbed, blocked: false, survived };
}

export function enemyAction(skills, index) {
  const actions = skills?.actions || [];
  return actions.length ? actions[index % actions.length] : { attack: true };
}

export function effectLabels(s) {
  const aura = ['火','水','木','癒','闇'];
  const duration = n => Number.isFinite(n) ? `（${n}ターン）` : '';
  const labels = s.defenses.map(d => {
    if (d.type === 'comboGuard') return `${d.chains}チェイン以下無効${duration(d.turns)}`;
    if (d.type === 'auraAbsorb') return `${aura[d.aura]}吸収${duration(d.turns)}`;
    return `${d.label || d.shape || '指定形状'}消しが必要${duration(d.turns)}`;
  });
  if (s.recovery) labels.push(`回復力${s.recovery.percent}%減少${duration(s.recovery.turns)}`);
  for (const [a,n] of Object.entries(s.auraBinds)) labels.push(`${aura[a]}消去不可${duration(n)}`);
  if (s.time) labels.push(`操作時間${s.time.type === 'timeFixed' ? '' : '−'}${s.time.seconds}秒${s.time.type === 'timeFixed' ? '固定' : ''}${duration(s.time.turns)}`);
  if (s.attackMult > 1) labels.push('敵攻撃力2倍');
  if (s.resolve?.active) labels.push(`根性（HP${s.resolve.threshold}%以下で解除）`);
  return labels;
}
