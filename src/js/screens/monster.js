/* ===================== モンスター画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, saveState } from '../core/state.js';
import { ELEMENTS, MONSTER_POOL, monsterById, TEAM_SIZE } from '../data/gamedata.js';
import { monRowHTML } from './parts.js';

let monsterTab = 'team';

export function initMonster() {
  $('tabTeamBtn').addEventListener('click', () => { monsterTab = 'team'; renderMonsterScreen(); });
  $('tabListBtn').addEventListener('click', () => { monsterTab = 'list'; renderMonsterScreen(); });
}

export function renderMonsterScreen() {
  $('tabTeamBtn').classList.toggle('active', monsterTab === 'team');
  $('tabListBtn').classList.toggle('active', monsterTab === 'list');
  $('monsterTeamPane').style.display = monsterTab === 'team' ? 'flex' : 'none';
  $('monsterListPane').style.display = monsterTab === 'list' ? 'block' : 'none';
  if (monsterTab === 'team') renderTeamPane(); else renderListPane();
}

function renderTeamPane() {
  const slotsEl = $('teamSlots');
  slotsEl.innerHTML = '';
  for (let i = 0; i < TEAM_SIZE; i++) {
    const id = state.team[i];
    const div = document.createElement('div');
    const filled = id && state.monsters[id];
    div.className = 'teamslot' + (filled ? ' filled' : '');
    const label = i === 0 ? 'リーダー' : 'サブ';
    div.innerHTML = filled
      ? `<div class="lbl">${label}</div>${ELEMENTS[monsterById(id).element].emoji}`
      : `<div class="lbl">${label}</div>➕`;
    slotsEl.appendChild(div);
  }

  const ownedEl = $('ownedList');
  ownedEl.innerHTML = '';
  const owned = Object.keys(state.monsters)
    .filter(id => state.monsters[id] > 0)
    .map(monsterById).filter(Boolean)
    .sort((a, b) => b.rarity - a.rarity);
  if (!owned.length) {
    ownedEl.innerHTML = '<div class="mstats">まだモンスターを持っていません。ガチャやショップで仲間を増やそう。</div>';
    return;
  }
  owned.forEach(m => {
    const inTeam = state.team.includes(m.id);
    const row = document.createElement('div');
    row.className = 'mon-row';
    row.innerHTML = monRowHTML(m, state.monsters[m.id])
      + `<button class="btn ${inTeam ? 'secondary' : ''} selbtn">${inTeam ? '外す' : '編成'}</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (inTeam) {
        state.team = state.team.filter(x => x !== m.id);
      } else {
        if (state.team.filter(Boolean).length >= TEAM_SIZE) { toast(`編成は最大${TEAM_SIZE}体までです`); return; }
        state.team = state.team.filter(Boolean);
        state.team.push(m.id);
      }
      while (state.team.length < TEAM_SIZE) state.team.push(null);
      saveState();
      renderTeamPane();
    });
    ownedEl.appendChild(row);
  });
}

function renderListPane() {
  const el = $('allMonsterList');
  el.innerHTML = '';
  MONSTER_POOL.slice()
    .sort((a, b) => a.element - b.element || a.rarity - b.rarity)
    .forEach(m => {
      const count = state.monsters[m.id] || 0;
      const row = document.createElement('div');
      row.className = 'mon-row' + (count ? '' : ' locked');
      row.innerHTML = monRowHTML(m, count);
      el.appendChild(row);
    });
}
