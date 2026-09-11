/* ===================== ダンジョン画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, hasStamina, spendStamina } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import { STAGES, FLOORS_PER_STAGE, HARD_REWARD_MULT, HARD_STAMINA_MULT, ELEMENTS, COLOR_HEX, monsterById } from '../data/gamedata.js';
import { startDungeonRun } from '../battle/battle.js';
import { fetchFriendRentals } from '../core/friends.js';

let dungeonHard = false;
let pendingStage = null, pendingHard = false;

export function initDungeon() {
  $('diffNormalBtn').addEventListener('click', () => { dungeonHard = false; renderDungeon(); });
  $('diffHardBtn').addEventListener('click', () => { dungeonHard = true; renderDungeon(); });
  $('friendPickSkipBtn').addEventListener('click', () => confirmAndStart(null));
  $('friendPickCloseBtn').addEventListener('click', closeFriendPick);
}

export function staminaCost(stage, hard) {
  return hard ? Math.round(stage.stamina * HARD_STAMINA_MULT) : stage.stamina;
}

function closeFriendPick() {
  $('friendPickModal').classList.remove('show');
  pendingStage = null;
}

/** ダンジョン出発前にフレンドモンスターを選ばせるモーダルを開く */
async function openFriendPick(stage, hard) {
  pendingStage = stage; pendingHard = hard;
  $('friendPickModal').classList.add('show');
  const box = $('friendPickList');
  box.innerHTML = '<div class="mstats">読み込み中…</div>';
  const rentals = await fetchFriendRentals();
  if (pendingStage !== stage) return; // モーダルを閉じた後に返ってきた場合は無視
  box.innerHTML = '';
  if (!rentals.length) {
    box.innerHTML = '<div class="mstats">貸し出し中のフレンドモンスターがありません。フレンドに「マイページ」でレンタルモンスターを設定してもらいましょう。</div>';
    return;
  }
  rentals.forEach(f => {
    const m = monsterById(f.monsterId);
    if (!m) return;
    const el = ELEMENTS[m.element];
    const row = document.createElement('div');
    row.className = 'mon-row';
    row.innerHTML = `<div class="elemicon" style="background:${COLOR_HEX[el.key]}33;color:${COLOR_HEX[el.key]}">${el.emoji}</div>
      <div class="minfo">
        <div class="mname">${m.name}</div>
        <div class="mstats">${f.icon || '🙂'} ${f.name} の貸し出し / ATK ${m.atk} / HP ${m.hp}</div>
      </div>
      <button class="btn selbtn" style="padding:7px 12px;font-size:11px;">選ぶ</button>`;
    row.querySelector('button').addEventListener('click', () => {
      confirmAndStart({ ...m, isFriend: true, friendName: f.name, friendIcon: f.icon });
    });
    box.appendChild(row);
  });
}

function confirmAndStart(friendMonster) {
  const stage = pendingStage, hard = pendingHard;
  if (!stage) return;
  $('friendPickModal').classList.remove('show');
  pendingStage = null;
  const cost = staminaCost(stage, hard);
  if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
  if (!spendStamina(cost)) { updateStatusBar(); return; }
  updateStatusBar();
  startDungeonRun(stage, hard, friendMonster);
}

export function renderDungeon() {
  $('diffNormalBtn').classList.toggle('active', !dungeonHard);
  $('diffHardBtn').classList.toggle('active', dungeonHard);
  const list = $('stageList');
  list.innerHTML = '';

  STAGES.forEach((stage, i) => {
    const prog = state.progress[stage.id] || {};
    const unlockedNormal = i === 0 || (state.progress[STAGES[i - 1].id] || {}).normal;
    const unlockedHard = prog.normal === true;
    const isLocked = dungeonHard ? !unlockedHard : !unlockedNormal;
    const cleared = dungeonHard ? prog.hard : prog.normal;
    const cost = staminaCost(stage, dungeonHard);
    const rewardCoin = Math.round(stage.coinReward * (dungeonHard ? HARD_REWARD_MULT : 1));
    const rewardFrepo = Math.round(stage.frepoReward * (dungeonHard ? HARD_REWARD_MULT : 1));
    const orb = stage.orbReward
      ? ` 💎${dungeonHard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward}` : '';
    const record = state.records[stage.id + '_' + (dungeonHard ? 'hard' : 'normal')];

    const div = document.createElement('div');
    div.className = 'stage-card' + (isLocked ? ' locked' : '');
    div.innerHTML = `
      <div class="semoji">${stage.floors[0].emoji}</div>
      <div class="sinfo">
        <div class="sname">${stage.name}${dungeonHard ? ' (ハード)' : ''} ${cleared ? '<span class="clearbadge">CLEAR</span>' : ''}</div>
        <div class="ssub">全${FLOORS_PER_STAGE}フロア ・ 報酬 💰${rewardCoin} 🎗️${rewardFrepo}${orb}</div>
        <div class="ssub">${record ? `最高連鎖 ${record.maxChain}` : '未挑戦'}</div>
      </div>
      <div class="scost"><span class="stcost">⚡${cost}</span><span class="starrow">${isLocked ? '🔒' : '▶'}</span></div>`;

    if (!isLocked) {
      div.addEventListener('click', () => {
        if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
        openFriendPick(stage, dungeonHard);
      });
    }
    list.appendChild(div);
  });
}
