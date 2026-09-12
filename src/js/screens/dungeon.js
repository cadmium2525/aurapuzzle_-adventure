/* =========================================================
 * dungeon.js — ダンジョン画面とサポート選択
 * サポート枠はフレンドの貸し出しキャラに加えて、いつでも選べる
 * NPCサポートを用意している(フレンドがいなくても困らない)。
 * =======================================================*/
import { $, toast } from '../core/ui.js';
import { state, hasStamina, spendStamina, ownCharacters } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  STAGES, FLOORS_PER_STAGE, HARD_REWARD_MULT, HARD_STAMINA_MULT,
  AURAS, COLOR_HEX, characterById, resolveCharacter,
  availableNpcSupports, NPC_SUPPORTS, materialById, crystalIdFor
} from '../data/gamedata.js';
import { startDungeonRun } from '../battle/battle.js';
import { fetchFriendRentals } from '../core/friends.js';
import { portraitHTML, awakenPipsHTML } from './parts.js';

let dungeonHard = false;
let pendingStage = null, pendingHard = false;
let supportTab = 'friend';
let friendRentals = null;      // 取得済みのフレンド貸し出しキャラ(null=未取得)

export function initDungeon() {
  $('diffNormalBtn').addEventListener('click', () => { dungeonHard = false; renderDungeon(); });
  $('diffHardBtn').addEventListener('click', () => { dungeonHard = true; renderDungeon(); });
  $('supportSkipBtn').addEventListener('click', () => confirmAndStart(null));
  $('supportCloseBtn').addEventListener('click', closeSupportPick);
  $('supportPickModal').addEventListener('click', e => {
    if (e.target === $('supportPickModal')) closeSupportPick();
  });
  $('supTabFriendBtn').addEventListener('click', () => { supportTab = 'friend'; renderSupportList(); });
  $('supTabNpcBtn').addEventListener('click', () => { supportTab = 'npc'; renderSupportList(); });
}

export function staminaCost(stage, hard) {
  return hard ? Math.round(stage.stamina * HARD_STAMINA_MULT) : stage.stamina;
}

function closeSupportPick() {
  $('supportPickModal').classList.remove('show');
  pendingStage = null;
}

/* ===================== サポート選択 ===================== */
async function openSupportPick(stage, hard) {
  pendingStage = stage; pendingHard = hard;
  friendRentals = null;
  // フレンドが1人もいなければ最初からNPCタブを開く
  supportTab = state.profile.friends.length ? 'friend' : 'npc';
  $('supportPickModal').classList.add('show');
  renderSupportList();

  const rentals = await fetchFriendRentals();
  if (pendingStage !== stage) return;   // モーダルを閉じた後に返ってきたら無視
  friendRentals = rentals;
  if (supportTab === 'friend') renderSupportList();
}

/** サポート候補1件ぶんの行を作る */
function supportRow(ch, ownerName, ownerIcon, isNpc, note) {
  const aura = AURAS[ch.aura];
  const ls = ch.leaderSkill;
  const row = document.createElement('div');
  row.className = 'support-row' + (isNpc ? ' npc' : '');
  row.style.setProperty('--aura', COLOR_HEX[aura.key]);
  row.innerHTML = `
    ${portraitHTML(ch)}
    <div class="cinfo">
      <div class="cname">${ch.name}
        <span class="sup-lv">Lv${ch.level}</span>
        ${ch.evolved ? '<span class="evo-tag">進化</span>' : ''}
        ${ch.awaken ? awakenPipsHTML(ch.awaken, 4) : ''}
        <span class="owner">${ownerIcon || '🙂'} ${ownerName}</span></div>
      <div class="cstats"><b>ATK</b>${ch.atk} <b>HP</b>${ch.hp} <b>RCV</b>${ch.rcv}</div>
      <div class="cskills"><span class="mini-tag ls">LS</span>${ls ? ls.name : '—'}
        <span class="ls-desc">${ls ? ls.desc : ''}</span></div>
      ${note ? `<div class="mstats">${note}</div>` : ''}
    </div>
    <button class="btn selbtn">選ぶ</button>`;
  row.querySelector('button').addEventListener('click', () => {
    confirmAndStart({ ...ch, isSupport: true, isNpc, ownerName, ownerIcon });
  });
  return row;
}

function renderSupportList() {
  $('supTabFriendBtn').classList.toggle('active', supportTab === 'friend');
  $('supTabNpcBtn').classList.toggle('active', supportTab === 'npc');
  const box = $('supportPickList');
  box.innerHTML = '';

  if (supportTab === 'friend') {
    if (friendRentals === null) {
      box.innerHTML = '<div class="empty">読み込み中…</div>';
      return;
    }
    if (!friendRentals.length) {
      box.innerHTML = `<div class="empty">貸し出し中のフレンドキャラがいません。<br>
        「NPC」タブからいつでもサポートを選べます。</div>`;
      return;
    }
    friendRentals.forEach(f => {
      const ch = resolveCharacter(f.charId, f.star, f.lv, f.awa);
      if (!ch) return;
      box.appendChild(supportRow(ch, f.name, f.icon, false));
    });
    return;
  }

  // NPCサポート(ランクで解放)
  const avail = availableNpcSupports(state.rank);
  avail.forEach(n => {
    const ch = resolveCharacter(n.charId, n.star, n.level);
    if (!ch) return;
    box.appendChild(supportRow(ch, n.name, n.icon, true));
  });
  const locked = NPC_SUPPORTS.filter(n => state.rank < n.rank);
  if (locked.length) {
    const next = locked[0];
    const div = document.createElement('div');
    div.className = 'empty locked-note';
    div.innerHTML = `🔒 次のNPCサポート「${next.name}」は <b>Rank ${next.rank}</b> で解放`;
    box.appendChild(div);
  }
}

function confirmAndStart(support) {
  const stage = pendingStage, hard = pendingHard;
  if (!stage) return;
  $('supportPickModal').classList.remove('show');
  pendingStage = null;
  const cost = staminaCost(stage, hard);
  if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
  if (!spendStamina(cost)) { updateStatusBar(); return; }
  updateStatusBar();
  startDungeonRun(stage, hard, support);
}

/* ===================== ステージ一覧 ===================== */
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
    const enough = state.stamina >= cost;
    const rewardCoin = Math.round(stage.coinReward * (dungeonHard ? HARD_REWARD_MULT : 1));
    const rewardFrepo = Math.round(stage.frepoReward * (dungeonHard ? HARD_REWARD_MULT : 1));
    const orb = stage.orbReward
      ? ` 💎${dungeonHard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward}` : '';
    const record = state.records[stage.id + '_' + (dungeonHard ? 'hard' : 'normal')];
    const dropMat = materialById(crystalIdFor(stage.dropAura));

    const div = document.createElement('div');
    div.className = 'stage-card' + (isLocked ? ' locked' : '') + (cleared ? ' cleared' : '');
    div.innerHTML = `
      <div class="stage-emoji">${stage.floors[FLOORS_PER_STAGE - 1].emoji}</div>
      <div class="sinfo">
        <div class="sname">${stage.name}${dungeonHard ? '<span class="hardtag">HARD</span>' : ''}
          ${cleared ? '<span class="clearbadge">CLEAR</span>' : ''}</div>
        <div class="ssub">全${FLOORS_PER_STAGE}フロア ・ 💰${rewardCoin} 🎗️${rewardFrepo}${orb}</div>
        <div class="ssub dim">${dropMat.emoji}${dropMat.name} ドロップ ・ ${record ? `最高コンボ ${record.maxChain}` : '未挑戦'}</div>
      </div>
      <div class="scost">
        <span class="stcost${enough || isLocked ? '' : ' short'}">⚡${cost}</span>
        <span class="starrow">${isLocked ? '🔒' : '▶'}</span>
      </div>`;

    if (!isLocked) {
      div.addEventListener('click', () => {
        if (!ownCharacters().length) { toast('先にキャラクターを編成してください'); return; }
        if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
        openSupportPick(stage, dungeonHard);
      });
    }
    list.appendChild(div);
  });
}
