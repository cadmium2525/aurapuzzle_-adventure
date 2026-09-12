/* =========================================================
 * character.js — キャラクター画面(編成 / 図鑑)
 * 自陣は人物キャラクター3人。先頭がリーダーでリーダースキルが発動する。
 * =======================================================*/
import { $, toast } from '../core/ui.js';
import { state, saveState, ownedCharacters, ownCharacters } from '../core/state.js';
import {
  AURAS, COLOR_HEX, CHARACTERS, characterById, TEAM_SIZE,
  BASE_PARTY_HP, BASE_DRAG_TIME, leaderSkillOf
} from '../data/gamedata.js';
import { charRowHTML, charDetailHTML, portraitHTML } from './parts.js';

let tab = 'team';
let detailChar = null;

export function initCharacter() {
  $('tabTeamBtn').addEventListener('click', () => { tab = 'team'; renderCharacterScreen(); });
  $('tabListBtn').addEventListener('click', () => { tab = 'list'; renderCharacterScreen(); });
  $('charDetailCloseBtn').addEventListener('click', closeDetail);
  $('charDetailModal').addEventListener('click', e => {
    if (e.target === $('charDetailModal')) closeDetail();
  });
  $('charDetailActionBtn').addEventListener('click', () => {
    if (!detailChar) return;
    toggleTeam(detailChar.id);
    closeDetail();
  });
}

function closeDetail() { $('charDetailModal').classList.remove('show'); detailChar = null; }

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

function openDetail(ch, canEquip) {
  detailChar = ch;
  const inTeam = state.team.includes(ch.id);
  const owned = (state.characters[ch.id] || 0) > 0;
  $('charDetailBody').innerHTML = charDetailHTML(ch,
    owned ? '' : '<div class="cd-note">まだ仲間にしていません。ガチャやショップで探しましょう。</div>');
  const btn = $('charDetailActionBtn');
  btn.style.display = (canEquip && owned) ? 'block' : 'none';
  btn.textContent = inTeam ? '編成から外す' : '編成に入れる';
  btn.className = 'btn block' + (inTeam ? ' secondary' : '');
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
      div.addEventListener('click', () => openDetail(ch, true));
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
  const ls = leaderSkillOf(team[0]);
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
    const row = document.createElement('div');
    row.className = 'char-row' + (inTeam ? ' in-team' : '');
    row.innerHTML = charRowHTML(ch, state.characters[ch.id])
      + `<div class="row-actions">
           <button class="btn ${inTeam ? 'secondary' : ''} selbtn">${inTeam ? '外す' : '編成'}</button>
           <button class="btn ghost tiny detailbtn">詳細</button>
         </div>`;
    row.querySelector('.selbtn').addEventListener('click', () => toggleTeam(ch.id));
    row.querySelector('.detailbtn').addEventListener('click', () => openDetail(ch, true));
    ownedEl.appendChild(row);
  });
}

/* ===================== 図鑑タブ ===================== */
function renderListPane() {
  const el = $('allCharacterList');
  el.innerHTML = '';
  CHARACTERS.slice()
    .sort((a, b) => a.aura - b.aura || a.rarity - b.rarity)
    .forEach(ch => {
      const count = state.characters[ch.id] || 0;
      const row = document.createElement('div');
      row.className = 'char-row' + (count ? '' : ' locked');
      row.innerHTML = charRowHTML(ch, count);
      row.addEventListener('click', () => openDetail(ch, false));
      el.appendChild(row);
    });
}
