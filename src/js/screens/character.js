/* =========================================================
 * character.js — キャラクター画面(編成 / 図鑑 / 進化)
 * 自陣は人物キャラクター3人。先頭がリーダーでリーダースキルが発動する。
 * =======================================================*/
import { $, toast } from '../core/ui.js';
import {
  state, saveState, ownedCharacters, ownCharacters, resolveOwned,
  entryOf, evolveCheck, evolveCharacter, materialCount,
  awakenCheck, awakenCharacter
} from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, COLOR_HEX, CHARACTERS, characterById, resolveCharacter, TEAM_SIZE,
  BASE_PARTY_HP, BASE_DRAG_TIME, MATERIALS, materialById, RARITY_TITLE,
  AWAKEN_MAX, awakenStepsFor
} from '../data/gamedata.js';
import { charRowHTML, charDetailHTML, portraitHTML, levelBarHTML, awakenPipsHTML } from './parts.js';

let tab = 'team';
let detailId = null;          // 詳細を開いているキャラのID
let detailOwned = false;

export function initCharacter() {
  $('tabTeamBtn').addEventListener('click', () => { tab = 'team'; renderCharacterScreen(); });
  $('tabListBtn').addEventListener('click', () => { tab = 'list'; renderCharacterScreen(); });
  $('charDetailCloseBtn').addEventListener('click', closeDetail);
  $('charDetailModal').addEventListener('click', e => {
    if (e.target === $('charDetailModal')) closeDetail();
  });
  $('charDetailActionBtn').addEventListener('click', () => {
    if (!detailId) return;
    toggleTeam(detailId);
    closeDetail();
  });
  $('charEvolveBtn').addEventListener('click', doEvolve);
  $('charAwakenBtn').addEventListener('click', doAwaken);
  $('evoResultCloseBtn').addEventListener('click', () => {
    $('evoResultModal').classList.remove('show');
  });
}

function closeDetail() { $('charDetailModal').classList.remove('show'); detailId = null; }

/** 編成へ入れる / 外す */
function toggleTeam(id) {
  if (state.team.includes(id)) {
    state.team = state.team.filter(x => x !== id);
  } else {
    if (state.team.filter(Boolean).length >= TEAM_SIZE) {
      toast(`編成は最大${TEAM_SIZE}人までです`); return;
    }
    state.team = state.team.filter(Boolean);
    state.team.push(id);
  }
  while (state.team.length < TEAM_SIZE) state.team.push(null);
  saveState();
  renderTeamPane();
}

/** 編成の並び替え(先頭がリーダー) */
function moveInTeam(index, dir) {
  const team = state.team.filter(Boolean);
  const to = index + dir;
  if (to < 0 || to >= team.length) return;
  [team[index], team[to]] = [team[to], team[index]];
  state.team = team;
  while (state.team.length < TEAM_SIZE) state.team.push(null);
  saveState();
  renderTeamPane();
}

export function renderCharacterScreen() {
  $('tabTeamBtn').classList.toggle('active', tab === 'team');
  $('tabListBtn').classList.toggle('active', tab === 'list');
  $('characterTeamPane').style.display = tab === 'team' ? 'flex' : 'none';
  $('characterListPane').style.display = tab === 'list' ? 'block' : 'none';
  if (tab === 'team') renderTeamPane(); else renderListPane();
}

/* ===================== 進化 ===================== */
/** 詳細モーダルの進化セクションを描く */
function renderEvolveBox(id) {
  const box = $('charEvolveBox');
  const btn = $('charEvolveBtn');
  const e = entryOf(id);
  if (!e) { box.style.display = 'none'; btn.style.display = 'none'; return; }

  const check = evolveCheck(id);
  const base = characterById(id);
  box.style.display = 'block';

  if (!check.need) {                       // ★5到達済み
    box.innerHTML = `<div class="evo-title">進化</div>
      <div class="evo-done">✨ 最終進化に到達しています</div>`;
    btn.style.display = 'none';
    return;
  }

  const need = check.need;
  const crystal = materialById(need.crystalId);
  const lvOK = e.lv >= need.level;
  const cOK = materialCount(need.crystalId) >= need.crystal;
  const sOK = materialCount('mt_star') >= need.shard;
  const coinOK = state.coin >= need.coin;
  const after = resolveCharacter(id, check.nextStar, Math.min(e.lv, 99));
  const now = resolveOwned(id);

  const req = (ok, label, have, want) =>
    `<div class="evo-req${ok ? ' ok' : ''}"><span>${label}</span>
      <b>${have} / ${want}</b>${ok ? '<i>✔</i>' : ''}</div>`;

  box.innerHTML = `
    <div class="evo-title">進化 ★${e.star} → ★${check.nextStar}
      <span class="evo-next">${RARITY_TITLE[check.nextStar]}</span></div>
    <div class="evo-reqs">
      ${req(lvOK, 'レベル', e.lv, need.level)}
      ${req(cOK, `${crystal.emoji} ${crystal.name}`, materialCount(need.crystalId), need.crystal)}
      ${req(sOK, '💠 進化の輝石', materialCount('mt_star'), need.shard)}
      ${req(coinOK, '💰 コイン', state.coin.toLocaleString(), need.coin.toLocaleString())}
    </div>
    <div class="evo-preview">
      <div class="evo-col"><span>ATK</span><b>${now.atk}</b><i>→</i><b class="up">${after.atk}</b></div>
      <div class="evo-col"><span>HP</span><b>${now.hp}</b><i>→</i><b class="up">${after.hp}</b></div>
      <div class="evo-col"><span>RCV</span><b>${now.rcv}</b><i>→</i><b class="up">${after.rcv}</b></div>
    </div>
    <div class="evo-skillup">
      <div class="skill-line on"><span class="skill-tag ls">LS</span>
        <span><b>${after.leaderSkill.name}</b><br>${after.leaderSkill.desc}</span></div>
      <div class="skill-line on"><span class="skill-tag sk">SKILL</span>
        <span><b>${after.skill.name}</b>(CT ${after.skill.cooldown})<br>${after.skill.desc}</span></div>
    </div>
    ${base.artStages ? '<div class="evo-note">✨ 進化でイラストが変化します</div>' : ''}
    ${check.ok ? '' : `<div class="evo-note warn">${check.reason}</div>`}`;

  btn.style.display = 'block';
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `★${check.nextStar} へ進化する` : '進化できません';
}

/* ===================== 開眼 ===================== */
/** 詳細モーダルの開眼セクションを描く */
function renderAwakenBox(id) {
  const box = $('charAwakenBox');
  const btn = $('charAwakenBtn');
  const e = entryOf(id);
  const base = characterById(id);
  if (!e || !base) { box.style.display = 'none'; btn.style.display = 'none'; return; }

  const cur = Math.min(AWAKEN_MAX, e.awa || 0);
  const steps = awakenStepsFor(base);
  const check = awakenCheck(id);
  box.style.display = 'block';

  const rows = steps.map((st, i) => {
    const done = i < cur;
    const next = i === cur;
    return `<div class="aw-row${done ? ' done' : ''}${next ? ' next' : ''}">
      <span class="aw-no">${i + 1}</span>
      <span class="aw-eff">${st.label}</span>
      ${done ? '<i>✔</i>' : (next ? '<i class="aw-nexttag">次</i>' : '')}
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="evo-title">開眼 ${awakenPipsHTML(cur, AWAKEN_MAX)}
      <span class="evo-next">${cur} / ${AWAKEN_MAX}</span></div>
    <div class="aw-list">${rows}</div>
    <div class="evo-req${(e.n || 0) >= 2 ? ' ok' : ''}">
      <span>同じキャラクター(手持ち)</span><b>${e.n || 0} / 2</b>${(e.n || 0) >= 2 ? '<i>✔</i>' : ''}
    </div>
    <div class="evo-note">開眼すると同じキャラクターを1体使います。</div>
    ${check.ok || cur >= AWAKEN_MAX ? '' : `<div class="evo-note warn">${check.reason}</div>`}`;

  if (cur >= AWAKEN_MAX) { btn.style.display = 'none'; return; }
  btn.style.display = 'block';
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `開眼する(${cur + 1}段階目)` : '開眼できません';
}

function doAwaken() {
  if (!detailId) return;
  const res = awakenCharacter(detailId);
  if (!res.ok) { toast(res.message); return; }
  toast(`開眼 ${res.to} 段階目: ${res.step ? res.step.label : ''}`);
  updateStatusBar();
  openDetail(detailId, detailOwned);
  renderTeamPane();
}

function doEvolve() {
  if (!detailId) return;
  const res = evolveCharacter(detailId);
  if (!res.ok) { toast(res.message); return; }
  saveState();
  updateStatusBar();
  showEvolveResult(res.before, res.after);
  openDetail(detailId, detailOwned);
  renderTeamPane();
}

/** 進化の演出モーダル */
function showEvolveResult(before, after) {
  const aura = AURAS[after.aura];
  $('evoResultBody').innerHTML = `
    <div class="evo-burst"></div>
    <div class="evo-res-head" style="--aura:${COLOR_HEX[aura.key]}">
      ${portraitHTML(after, 'big')}
    </div>
    <div class="evo-res-name">${after.name}</div>
    <div class="evo-res-star">★${before.star} → <b>★${after.star}</b></div>
    <div class="evo-res-stats">
      <div><span>ATK</span><b>${before.atk} → ${after.atk}</b></div>
      <div><span>HP</span><b>${before.hp} → ${after.hp}</b></div>
      <div><span>RCV</span><b>${before.rcv} → ${after.rcv}</b></div>
    </div>
    <div class="skill-line on"><span class="skill-tag ls">LS</span>
      <span><b>${after.leaderSkill.name}</b><br>${after.leaderSkill.desc}</span></div>
    <div class="skill-line on"><span class="skill-tag sk">SKILL</span>
      <span><b>${after.skill.name}</b>(CT ${after.skill.cooldown})<br>${after.skill.desc}</span></div>`;
  $('evoResultModal').classList.add('show');
}

/* ===================== 詳細モーダル ===================== */
function openDetail(id, canEquip) {
  detailId = id;
  detailOwned = canEquip;
  const owned = !!entryOf(id);
  const ch = owned ? resolveOwned(id) : resolveCharacter(id, null, 1);
  const inTeam = state.team.includes(id);

  $('charDetailBody').innerHTML = charDetailHTML(ch,
    owned ? '' : '<div class="cd-note">まだ仲間にしていません。ガチャやショップで探しましょう。</div>');
  const btn = $('charDetailActionBtn');
  btn.style.display = (canEquip && owned) ? 'block' : 'none';
  btn.textContent = inTeam ? '編成から外す' : '編成に入れる';
  btn.className = 'btn block' + (inTeam ? ' secondary' : '');
  if (owned) { renderEvolveBox(id); renderAwakenBox(id); }
  else {
    $('charEvolveBox').style.display = 'none'; $('charEvolveBtn').style.display = 'none';
    $('charAwakenBox').style.display = 'none'; $('charAwakenBtn').style.display = 'none';
  }
  $('charDetailModal').classList.add('show');
}

/* ===================== 編成タブ ===================== */
function renderTeamPane() {
  const team = ownCharacters();
  const slotsEl = $('teamSlots');
  slotsEl.innerHTML = '';

  for (let i = 0; i < TEAM_SIZE; i++) {
    const ch = team[i];
    const div = document.createElement('div');
    div.className = 'teamslot' + (ch ? ' filled' : '');
    if (ch) {
      div.style.setProperty('--aura', COLOR_HEX[AURAS[ch.aura].key]);
      div.innerHTML = `
        <span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        ${portraitHTML(ch)}
        <span class="slot-name">${ch.name}</span>
        <span class="slot-lv">Lv${ch.level}</span>
        <span class="slot-move">
          <button class="mv" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="前へ">▲</button>
          <button class="mv" data-dir="1" ${i === team.length - 1 ? 'disabled' : ''} aria-label="後ろへ">▼</button>
        </span>`;
      div.querySelectorAll('.mv').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          moveInTeam(i, Number(b.dataset.dir));
        });
      });
      div.addEventListener('click', () => openDetail(ch.id, true));
    } else {
      div.innerHTML = `<span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        <span class="slot-empty">＋</span><span class="slot-name">空き</span>`;
    }
    slotsEl.appendChild(div);
  }

  const sup = document.createElement('div');
  sup.className = 'teamslot support-slot';
  sup.innerHTML = `<span class="slot-label">サポート</span>
    <span class="slot-empty">🤝</span>
    <span class="slot-name">出発時に選択</span>`;
  slotsEl.appendChild(sup);

  // パーティ概要
  const totalHP = BASE_PARTY_HP + team.reduce((s, m) => s + m.hp, 0);
  const auraSet = [...new Set(team.map(m => m.aura))]
    .map(a => `<span class="aura-chip" style="--aura:${COLOR_HEX[AURAS[a].key]}">${AURAS[a].emoji}${AURAS[a].name}</span>`)
    .join('');
  const ls = team.length ? team[0].leaderSkill : null;
  const extraTime = (ls && ls.time) ? ls.time : 0;
  $('teamSummary').innerHTML = team.length ? `
    <div class="ts-row"><span>合計HP(サポート除く)</span><b>${totalHP}</b></div>
    <div class="ts-row"><span>攻撃できるオーラ</span><b class="aura-chips">${auraSet}</b></div>
    <div class="ts-row"><span>操作時間(自陣LSのみ)</span><b>${((BASE_DRAG_TIME / 1000) + extraTime).toFixed(1)}秒</b></div>`
    : '<div class="empty">キャラクターを編成してください。</div>';

  // リーダースキル
  $('teamLeaderSkill').innerHTML = ls
    ? `<div class="skill-line on"><span class="skill-tag ls">LS</span>
         <span><b>${ls.name}</b><br>${ls.desc}</span></div>
       <div class="mstats mt6">サポート枠のリーダースキルも発動します(ダンジョン出発時に選択)。</div>`
    : '<div class="empty">リーダーが未設定です。</div>';

  renderMaterials();

  // 所持キャラ一覧
  const ownedEl = $('ownedList');
  ownedEl.innerHTML = '';
  const owned = ownedCharacters();
  $('ownedCount').textContent = `${owned.length} / ${CHARACTERS.length} 人`;
  if (!owned.length) {
    ownedEl.innerHTML = '<div class="empty">まだ仲間がいません。ガチャやショップで仲間を増やそう。</div>';
    return;
  }
  owned.forEach(ch => {
    const inTeam = state.team.includes(ch.id);
    const canEvolve = evolveCheck(ch.id).ok;
    const row = document.createElement('div');
    row.className = 'char-row' + (inTeam ? ' in-team' : '');
    row.innerHTML = charRowHTML(ch, ch.count)
      + `<div class="row-actions">
           <button class="btn ${inTeam ? 'secondary' : ''} selbtn">${inTeam ? '外す' : '編成'}</button>
           <button class="btn ghost tiny detailbtn">${canEvolve ? '進化可' : '詳細'}</button>
         </div>`;
    if (canEvolve) row.classList.add('evolvable');
    row.querySelector('.selbtn').addEventListener('click', () => toggleTeam(ch.id));
    row.querySelector('.detailbtn').addEventListener('click', () => openDetail(ch.id, true));
    ownedEl.appendChild(row);
  });
}

/** 所持素材の表示 */
function renderMaterials() {
  const box = $('materialList');
  if (!box) return;
  box.innerHTML = MATERIALS.map(mt => `
    <div class="mt-chip" style="--mt:${mt.color}">
      <span class="mt-emoji">${mt.emoji}</span>
      <span class="mt-name">${mt.name}</span>
      <b class="mt-count">${materialCount(mt.id)}</b>
    </div>`).join('');
}

/* ===================== 図鑑タブ ===================== */
function renderListPane() {
  const el = $('allCharacterList');
  el.innerHTML = '';
  CHARACTERS.slice()
    .sort((a, b) => a.aura - b.aura || a.rarity - b.rarity)
    .forEach(base => {
      const e = entryOf(base.id);
      const ch = e ? resolveOwned(base.id) : resolveCharacter(base.id, null, 1);
      const row = document.createElement('div');
      row.className = 'char-row' + (e ? '' : ' locked');
      row.innerHTML = charRowHTML(ch, e ? e.n : 0);
      row.addEventListener('click', () => openDetail(base.id, false));
      el.appendChild(row);
    });
}
