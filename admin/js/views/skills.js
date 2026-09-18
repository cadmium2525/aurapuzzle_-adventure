/* スキル一覧 — リーダースキル / スキル / 敵の特殊行動を引くための画面 */
import { esc, card, $ } from '../ui.js';
import * as G from '../gamedata.js';
import * as edit from './skill-edit.js';

/** リーダースキルの効果を日本語にする */
function leaderEffects(s) {
  const out = [];
  if (s.allAtk) out.push(`全オーラ ×${s.allAtk}`);
  if (s.auraAtk) {
    Object.keys(s.auraAtk).forEach(k => {
      const i = G.COLORS.indexOf(k);
      out.push(`${G.AURA_NAME[i] || k} ×${s.auraAtk[k]}`);
    });
  }
  if (s.hp) out.push(`HP ×${s.hp}`);
  if (s.rcv) out.push(`回復 ×${s.rcv}`);
  if (s.time) out.push(`操作時間 +${s.time}秒`);
  if (s.damageCut) out.push(`被ダメ -${Math.round(s.damageCut * 100)}%`);
  if (s.comboAtk) out.push(`${s.comboAtk.combo}コンボ以上で ×${s.comboAtk.mult}`);
  if (s.matchMin) out.push(`消せる連結数 ${s.matchMin}`);
  return out;
}

/** アクティブスキルの効果を日本語にする */
function activeEffects(s) {
  const out = [];
  if (s.timeThisTurn) out.push(`このターン +${s.timeThisTurn}秒`);
  if (s.healPct) out.push(`HP ${Math.round(s.healPct * 100)}% 回復`);
  if (s.fixedDamage) out.push(`攻撃力 ×${s.fixedDamage} のダメージ`);
  if (s.convert) {
    // 2色以上変えるスキル(カイ)は配列で持っている
    [].concat(s.convert).forEach(c => {
      const from = G.AURA_NAME[G.COLORS.indexOf(c.from)] || c.from;
      const to = G.AURA_NAME[G.COLORS.indexOf(c.to)] || c.to;
      out.push(`${from} → ${to} に変換`);
    });
  }
  if (s.spawn) {
    const to = G.AURA_NAME[G.COLORS.indexOf(s.spawn.to)] || s.spawn.to;
    out.push(`${to} を ${s.spawn.count} 個生成`);
  }
  if (s.shuffle) out.push('盤面シャッフル');
  if (s.atkBuff) out.push(`攻撃 ×${s.atkBuff.mult} を ${s.atkBuff.turns}ターン`);
  if (s.guard) out.push(`被ダメ -${Math.round(s.guard.rate * 100)}% を ${s.guard.turns}ターン`);
  if (s.delay) out.push(`敵の攻撃を ${s.delay}ターン遅らせる`);
  return out;
}

/** そのスキルIDを使っているキャラの名前 */
function usersOf(key, field) {
  return G.CHARACTERS.filter(c => c[field] === key || c[`evo${field[0].toUpperCase()}${field.slice(1)}`] === key)
    .map(c => c.name);
}

function skillRow(id, s, effects, users, kind) {
  const mine = s._source === 'draft';
  return `<div class="row flat" data-find="${esc(id)}">
    <div class="grow">
      <b>${esc(s.name)} <span class="mono small" style="color:var(--ink-faint)">${esc(id)}</span>
        ${mine ? '<span class="tagline new">下書き</span>' : ''}</b>
      <span class="sub">${esc(s.desc || '')}</span>
      <span class="sub mono" style="color:var(--link)">${esc(effects.join(' ・ '))}</span>
      ${users.length ? `<span class="sub" style="color:var(--ink-faint)">使用: ${esc(users.join('、'))}</span>` : ''}
    </div>
    <button class="btn" data-copy="${esc(kind)}:${esc(id)}" style="padding:5px 9px;flex:0 0 auto">
      ${mine ? '編集' : '複製して調整'}</button>
  </div>`;
}

function enemyEffectRow(def) {
  const args = def.args.length
    ? def.args.map(a => `${a.key}${a.aura ? '(オーラ)' : ''}`).join(', ')
    : '引数なし';
  return `<button class="row flat" data-find="${esc(def.type)}">
    <div class="grow">
      <b>${esc(def.label)} <span class="mono small" style="color:var(--ink-faint)">${esc(def.type)}</span></b>
      <span class="sub">${esc(def.desc)}</span>
      <span class="sub mono" style="color:var(--link)">${esc(args)}</span>
    </div></button>`;
}

/** その特殊行動を使っているモンスター */
function enemiesUsing(type) {
  const hit = [];
  G.ENEMY_MASTER_IDS.forEach(id => {
    const count = G.formCountOf(id);
    for (let f = 0; f < count; f++) {
      const shape = G.enemyFormOf(id, f);
      const sk = shape && shape.enemySkills;
      if (!sk) continue;
      const all = [
        ...((sk.preemptive && sk.preemptive.effects) || []),
        ...(sk.actions || []).flatMap(a => a.effects || []),
        ...(sk.passives || [])
      ];
      if (all.some(e => e && e.type === type) && !hit.includes(shape.name)) hit.push(shape.name);
    }
  });
  return hit;
}

export default {
  render(view) {
    if (edit.isEditing()) { edit.renderEditing(view, () => this.render(view)); return; }
    const ls = edit.allSkills('leader');
    const as = edit.allSkills('active');

    const back = () => this.render(view);
    view.innerHTML = `
      <div class="note">新しい<b>効果の種類</b>そのものは足せません(battle/ の実装が要ります)。
      できるのは、既存スキルを分解したパーツを組み替えて倍率を変え、
      名前を付けて別のスキルにすることです。</div>
      <div class="card">
        <label class="field" style="margin:0">
          <span>絞り込み</span>
          <input type="search" id="q" placeholder="名前・ID・効果で探す">
        </label>
      </div>

      ${card(`敵の特殊行動 (${G.ENEMY_EFFECTS.length})`, `
        <p class="lead">モンスターの行動パターンに置ける効果。battle/enemy-skills.js が解釈できるものだけを並べています。</p>
        <div class="rows" id="enemyList">
          ${G.ENEMY_EFFECTS.map(def => {
            const users = enemiesUsing(def.type);
            return enemyEffectRow(def).replace('</div></button>',
              `${users.length ? `<span class="sub" style="color:var(--ink-faint)">使用: ${esc(users.join('、'))}</span>` : ''}</div></button>`);
          }).join('')}
        </div>`)}

      ${card(`リーダースキル (${ls.length})`, `<div class="rows" id="lsList">
        ${ls.map(s => skillRow(s.id, s, leaderEffects(s), usersOf(s.id, 'leaderSkillId'), 'leader')).join('')}
      </div>`, '<button class="btn primary" id="newLs">＋ 新規作成</button>')}

      ${card(`スキル (${as.length})`, `<div class="rows" id="asList">
        ${as.map(s => skillRow(s.id, s,
          activeEffects(s).concat(s.cooldown ? [`CT ${s.cooldown}`] : []),
          usersOf(s.id, 'skillId'), 'active')).join('')}
      </div>`, '<button class="btn primary" id="newSk">＋ 新規作成</button>')}
    `;

    $('newLs').addEventListener('click', () => edit.startNew('leader', view, back));
    $('newSk').addEventListener('click', () => edit.startNew('active', view, back));
    view.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => {
      const [kind, id] = btn.dataset.copy.split(':');
      const mine = (kind === 'leader' ? edit.allSkills('leader') : edit.allSkills('active'))
        .find(s => s.id === id);
      edit.startFrom(kind, id, view, back, mine && mine._source !== 'draft');
    }));

    const q = $('q');
    q.addEventListener('input', () => {
      const needle = q.value.trim().toLowerCase();
      view.querySelectorAll('.row[data-find]').forEach(row => {
        row.hidden = needle !== '' && !row.textContent.toLowerCase().includes(needle);
      });
    });
  }
};
