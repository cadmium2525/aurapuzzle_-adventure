/* ===================== ダンジョン画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, hasStamina, spendStamina } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import { STAGES, FLOORS_PER_STAGE, HARD_REWARD_MULT, HARD_STAMINA_MULT } from '../data/gamedata.js';
import { startDungeonRun } from '../battle/battle.js';

let dungeonHard = false;

export function initDungeon() {
  $('diffNormalBtn').addEventListener('click', () => { dungeonHard = false; renderDungeon(); });
  $('diffHardBtn').addEventListener('click', () => { dungeonHard = true; renderDungeon(); });
}

export function staminaCost(stage, hard) {
  return hard ? Math.round(stage.stamina * HARD_STAMINA_MULT) : stage.stamina;
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
        if (!spendStamina(cost)) { updateStatusBar(); return; }
        updateStatusBar();
        startDungeonRun(stage, dungeonHard);
      });
    }
    list.appendChild(div);
  });
}
