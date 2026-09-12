/* =========================================================
 * dungeon.js — ダンジョン画面とサポート選択
 * サポート枠はフレンドの貸し出しキャラに加えて、いつでも選べる
 * NPCサポートを用意している(フレンドがいなくても困らない)。
 * =======================================================*/
import { $, toast, artImg } from '../core/ui.js';
import { state, hasStamina, spendStamina, ownCharacters } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  STAGES, FLOORS_PER_STAGE, HARD_REWARD_MULT, HARD_STAMINA_MULT,
  AURAS, COLOR_HEX, characterById, resolveCharacter,
  availableNpcSupports, NPC_SUPPORTS, materialById, crystalIdFor,
  CHAPTER_COUNT, STAGES_PER_CHAPTER, chapterNameOf, chapterLastStageId,
  dailyStagesFor, DAILY_THEMES, todayTheme
} from '../data/gamedata.js';
import { startDungeonRun } from '../battle/battle.js';
import { fetchFriendRentals } from '../core/friends.js';
import { portraitHTML, awakenPipsHTML } from './parts.js';

let dungeonHard = false;
let dungeonMode = 'story';     // 'story' = 章ごとの通常 / 'daily' = 曜日ダンジョン
let chapter = 1;
let pendingStage = null, pendingHard = false;
let supportTab = 'friend';
let friendRentals = null;      // 取得済みのフレンド貸し出しキャラ(null=未取得)

export function initDungeon() {
  $('modeStoryBtn').addEventListener('click', () => { dungeonMode = 'story'; renderDungeon(); });
  $('modeDailyBtn').addEventListener('click', () => { dungeonMode = 'daily'; renderDungeon(); });
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
/** その章が解禁されているか(前の章の最終ステージをノーマルでクリア) */
export function chapterUnlocked(ch) {
  if (ch <= 1) return true;
  return !!(state.progress[chapterLastStageId(ch - 1)] || {}).normal;
}

/** 解禁済みのいちばん先の章 */
function latestChapter() {
  let last = 1;
  for (let c = 1; c <= CHAPTER_COUNT; c++) if (chapterUnlocked(c)) last = c;
  return last;
}

function renderChapterBar() {
  const bar = $('chapterBar');
  bar.innerHTML = '';
  for (let c = 1; c <= CHAPTER_COUNT; c++) {
    const ok = chapterUnlocked(c);
    const b = document.createElement('button');
    b.className = 'chapter-btn' + (c === chapter ? ' active' : '') + (ok ? '' : ' locked');
    b.innerHTML = ok ? `<b>${c}</b><span>${chapterNameOf(c)}</span>` : `<b>${c}</b><span>🔒</span>`;
    if (ok) b.addEventListener('click', () => { chapter = c; renderDungeon(); });
    bar.appendChild(b);
  }
}

export function renderDungeon() {
  $('modeStoryBtn').classList.toggle('active', dungeonMode === 'story');
  $('modeDailyBtn').classList.toggle('active', dungeonMode === 'daily');
  $('storyControls').hidden = dungeonMode !== 'story';
  $('dailyHead').hidden = dungeonMode !== 'daily';

  if (dungeonMode === 'daily') { renderDailyList(); return; }

  $('diffNormalBtn').classList.toggle('active', !dungeonHard);
  $('diffHardBtn').classList.toggle('active', dungeonHard);
  if (!chapterUnlocked(chapter)) chapter = latestChapter();
  renderChapterBar();

  const list = $('stageList');
  list.innerHTML = '';
  const inChapter = STAGES.filter(st => st.chapter === chapter);
  renderStageCards(list, inChapter);
}

/* ===================== 曜日ダンジョン ===================== */
function renderDailyList() {
  const today = new Date().getDay();
  const theme = todayTheme();
  $('dailyHead').innerHTML = `
    <div class="daily-title">${theme.emoji} ${theme.title}<span class="daily-day">${theme.label}曜</span></div>
    <div class="daily-note">${theme.note}</div>
    <div class="daily-week">${DAILY_THEMES.map(t =>
      `<span class="dw${t.day === today ? ' now' : ''}">${t.label}</span>`).join('')}</div>`;

  const list = $('stageList');
  list.innerHTML = '';
  renderStageCards(list, dailyStagesFor(today));
}

function renderStageCards(list, stages) {
  stages.forEach((stage) => {
    const prog = state.progress[stage.id] || {};
    const hard = stage.daily ? false : dungeonHard;      // 曜日ダンジョンにハードは無い
    let isLocked;
    if (stage.daily) {
      isLocked = state.rank < stage.requireRank;
    } else {
      const idx = STAGES.findIndex(x => x.id === stage.id);
      const prev = idx > 0 ? STAGES[idx - 1] : null;
      const unlockedNormal = !prev || (state.progress[prev.id] || {}).normal;
      isLocked = hard ? prog.normal !== true : !unlockedNormal;
    }
    const cleared = hard ? prog.hard : prog.normal;
    const cost = staminaCost(stage, hard);
    const enough = state.stamina >= cost;
    const rewardCoin = Math.round(stage.coinReward * (hard ? HARD_REWARD_MULT : 1));
    const rewardFrepo = Math.round(stage.frepoReward * (hard ? HARD_REWARD_MULT : 1));
    const orb = stage.orbReward
      ? ` 💎${hard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward}` : '';
    const record = state.records[stage.id + '_' + (hard ? 'hard' : 'normal')];
    const dropText = dropLabel(stage);

    const div = document.createElement('div');
    div.className = 'stage-card' + (isLocked ? ' locked' : '') + (cleared ? ' cleared' : '');
    div.innerHTML = `
      <div class="stage-emoji">${(() => { const b = stage.floors[FLOORS_PER_STAGE - 1];
        return artImg(b.sprite, b.emoji, 'senemy'); })()}</div>
      <div class="sinfo">
        <div class="sname">${stage.name}${hard ? '<span class="hardtag">HARD</span>' : ''}
          ${cleared ? '<span class="clearbadge">CLEAR</span>' : ''}</div>
        <div class="ssub">全${FLOORS_PER_STAGE}フロア ・ 💰${rewardCoin} 🎗️${rewardFrepo}${orb}</div>
        <div class="ssub dim">${dropText} ・ ${isLocked && stage.daily ? `ランク${stage.requireRank}で解放`
          : (record ? `最高コンボ ${record.maxChain}` : '未挑戦')}</div>
      </div>
      <div class="scost">
        <span class="stcost${enough || isLocked ? '' : ' short'}">⚡${cost}</span>
        <span class="starrow">${isLocked ? '🔒' : '▶'}</span>
      </div>`;

    if (!isLocked) {
      div.addEventListener('click', () => {
        if (!ownCharacters().length) { toast('先にキャラクターを編成してください'); return; }
        if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
        openSupportPick(stage, hard);
      });
    }
    list.appendChild(div);
  });
}

/** そのステージで何が手に入るかの1行表示 */
function dropLabel(stage) {
  if (stage.dropType === 'gold') return '💰 ゴールド特化';
  if (stage.dropType === 'exp') return '📗 キャラ経験値アイテム';
  const mat = materialById(crystalIdFor(stage.dropAura));
  return `${mat.emoji}${mat.name} ドロップ`;
}
