/* =========================================================
 * dungeon.js — ダンジョン画面と出撃の手順
 *
 * ステージを選んだあとは1つのモーダルの中で
 *   1. チーム(編成プリセット)を選ぶ
 *   2. サポートを選ぶ
 *   3. 4人そろった編成を確かめて突入する
 * の3段を進む。‹ で1段ずつ戻れる。
 *
 * サポート枠はフレンドの貸し出しキャラに加えて、いつでも選べる
 * NPCサポートを用意している(フレンドがいなくても困らない)。
 * =======================================================*/
import { $, toast, artImg, itemIcon, charIcon } from '../core/ui.js';
import {
  state, hasStamina, spendStamina, TEAM_PRESETS,
  charactersOfTeam, setTeamIndex, rememberLastTeam
} from '../core/state.js';
import { updateStatusBar, registerBackHandler, showScreen } from '../core/nav.js';
import {
  STAGES, HARD_REWARD_MULT, HARD_STAMINA_MULT, FLOORS_PER_STAGE,
  AURAS, COLOR_HEX, BASE_AURAS, characterById, resolveCharacter,
  availableNpcSupports, NPC_SUPPORTS, materialById, crystalIdFor,
  CHAPTER_COUNT, STAGES_PER_CHAPTER, chapterNameOf, chapterLastStageId,
  TECHNICAL_STAGES, TECH_CHAPTER_COUNT, techChapterNameOf, techChapterLastStageId,
  dailyStagesFor, DAILY_THEMES, todayTheme
} from '../data/gamedata.js';
import { startDungeonRun, resumeDungeonRun, pausedRun, discardPausedRun } from '../battle/battle.js';
import { fetchFriendRentals, fetchStrangerRentals } from '../core/friends.js';
import { portraitHTML, awakenPipsHTML } from './parts.js';
import { RAID_STAGES } from '../data/raids.js';
import { raidDropSummaryHTML } from '../data/raid-rewards.js';
import { isAvailable } from '../data/availability.js';

let dungeonHard = false;
// 'story' = 章ごとの通常 / 'technical' = 全フロア特殊行動 / 'daily' = 曜日 / 'raid' = 降臨
let dungeonMode = 'story';
let dungeonView = 'menu';      // ホームからはまず種別選択を開く
let chapter = 1;               // 通常ダンジョンで開いている章
let techChapter = 1;           // テクニカルで開いている階層
let pendingStage = null, pendingHard = false;
let sortieStep = 'team';       // 'team' | 'support' | 'confirm'
let pendingSupport = null;     // 選んだサポート(なしのときは null)
let supportTab = 'friend';
let friendRentals = null;      // 取得済みのフレンド貸し出しキャラ(null=未取得)
let strangerRentals = null;    // フレンド以外のプレイヤー(読み取り数を抑えるため使い回す)

export function initDungeon() {
  $('openStoryDungeonBtn').addEventListener('click', () => openDungeonType('story'));
  $('openTechDungeonBtn').addEventListener('click', () => openDungeonType('technical'));
  $('openDailyDungeonBtn').addEventListener('click', () => openDungeonType('daily'));
  $('openRaidDungeonBtn').addEventListener('click', () => openDungeonType('raid'));
  $('dungeonCategoryBackBtn').addEventListener('click', showDungeonMenu);
  $('diffNormalBtn').addEventListener('click', () => { dungeonHard = false; renderDungeon({ preserve: true }); });
  $('diffHardBtn').addEventListener('click', () => { dungeonHard = true; renderDungeon({ preserve: true }); });
  registerBackHandler('dungeon', handleDungeonBack);
  $('supportSkipBtn').addEventListener('click', () => pickSupport(null));
  $('sortieCloseBtn').addEventListener('click', closeSortie);
  $('sortieBackBtn').addEventListener('click', sortieBack);
  $('sortieGoBtn').addEventListener('click', startPendingRun);
  $('sortieModal').addEventListener('click', e => {
    if (e.target === $('sortieModal')) closeSortie();
  });
  $('supTabFriendBtn').addEventListener('click', () => { supportTab = 'friend'; renderSupportList(); });
  $('supTabOtherBtn').addEventListener('click', () => { supportTab = 'other'; renderSupportList(); });
  $('supTabNpcBtn').addEventListener('click', () => { supportTab = 'npc'; renderSupportList(); });
}

/* ===================== 中断したダンジョン ===================== */
/**
 * タスクキル等で中断したダンジョンがあれば、種別選択の上に復帰カードを出す。
 * スタミナは入場時に消費済みなので、再開では取り直さない。
 */
function renderResumeCard() {
  const box = $('dungeonResume');
  const paused = pausedRun();
  if (!paused || dungeonView !== 'menu') { box.hidden = true; box.innerHTML = ''; return; }
  const floors = paused.stage.floors ? paused.stage.floors.length : FLOORS_PER_STAGE;
  box.hidden = false;
  box.innerHTML = `
    <div class="resume-head"><span class="resume-kicker">CONTINUE</span>中断したダンジョン</div>
    <div class="resume-name">${paused.stage.name}${paused.hard ? ' / ハード' : ''}</div>
    <div class="resume-meta">フロア ${paused.floorIndex + 1} / ${floors} ・ HP ${Math.max(0, Math.round(paused.playerHP))}</div>
    <div class="resume-actions">
      <button class="btn" id="resumeRunBtn">続きから挑戦</button>
      <button class="btn ghost" id="discardRunBtn">やめる</button>
    </div>`;
  $('resumeRunBtn').addEventListener('click', () => {
    if (!resumeDungeonRun()) { toast('中断データを読み込めませんでした'); discardPausedRun(); renderResumeCard(); }
  });
  $('discardRunBtn').addEventListener('click', () => {
    if (!confirm('中断したダンジョンを終了します。消費したスタミナと進行は戻りません。よろしいですか?')) return;
    discardPausedRun();
    renderResumeCard();
    toast('中断したダンジョンを終了しました');
  });
}

function openDungeonType(mode) {
  dungeonMode = mode;
  dungeonView = 'stages';
  renderDungeon({ preserve: true });
  window.scrollTo({ top: 0 });
}

function showDungeonMenu() {
  dungeonView = 'menu';
  renderDungeon({ preserve: true });
  window.scrollTo({ top: 0 });
}

function handleDungeonBack() {
  if (dungeonView !== 'stages') return false;
  showDungeonMenu();
  return true;
}

export function staminaCost(stage, hard) {
  return hard ? Math.round(stage.stamina * HARD_STAMINA_MULT) : stage.stamina;
}

/* ===================== 出撃の3段 ===================== */
function closeSortie() {
  $('sortieModal').classList.remove('show');
  pendingStage = null;
  pendingSupport = null;
}

/** ステージを選んだところから始める */
export function openSortie(stage, hard = false) {
  if (!isAvailable(stage)) { toast('このダンジョンの開催期間外です'); return; }
  pendingStage = stage;
  pendingHard = hard;
  pendingSupport = null;
  sortieStep = 'team';
  $('sortieModal').classList.add('show');
  renderSortie();
}

/** ‹ で1段戻る。先頭ならモーダルごと閉じる */
function sortieBack() {
  if (sortieStep === 'confirm') { goStep('support'); return; }
  if (sortieStep === 'support') { goStep('team'); return; }
  closeSortie();
}

function goStep(step) {
  sortieStep = step;
  renderSortie();
}

const SORTIE_STEPS = [
  { key: 'team',    label: 'チーム' },
  { key: 'support', label: 'サポート' },
  { key: 'confirm', label: '確認' }
];

function renderSortie() {
  const at = SORTIE_STEPS.findIndex(s => s.key === sortieStep);
  $('sortieTitle').textContent =
    { team: 'チームを選ぶ', support: 'サポートを選ぶ', confirm: '編成の確認' }[sortieStep];
  $('sortieLead').innerHTML = {
    team: `${pendingStage ? pendingStage.name : ''}${pendingHard ? ' / ハード' : ''} に挑むチームを選びます。`,
    support: 'サポートの<b>リーダースキル</b>も発動します。フレンドがいなくてもNPCサポートを選べます。',
    confirm: 'この4人で挑みます。よければ突入してください。'
  }[sortieStep];
  $('sortieSteps').innerHTML = SORTIE_STEPS.map((st, i) =>
    `<span class="sortie-step${i === at ? ' now' : ''}${i < at ? ' done' : ''}">${i + 1}. ${st.label}</span>`).join('');

  $('sortieTeamStep').hidden = sortieStep !== 'team';
  $('sortieSupportStep').hidden = sortieStep !== 'support';
  $('sortieConfirmStep').hidden = sortieStep !== 'confirm';

  if (sortieStep === 'team') renderSortieTeams();
  if (sortieStep === 'support') openSupportPick();
  if (sortieStep === 'confirm') renderSortieConfirm();
}

/* --- 1. チーム選択 --- */
function renderSortieTeams() {
  const box = $('sortieTeamStep');
  box.innerHTML = '';
  for (let i = 0; i < TEAM_PRESETS; i++) {
    const members = charactersOfTeam(i);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'sortie-team' + (i === state.teamIndex ? ' active' : '') + (members.length ? '' : ' empty');
    const ls = members.length ? members[0].leaderSkill : null;
    row.innerHTML = `
      <span class="st-no">チーム${i + 1}</span>
      <span class="st-faces">${members.length
        ? members.map(m => `<i class="st-face" style="--aura:${COLOR_HEX[AURAS[m.aura].key]}">${charIcon(m.art && m.art.icon, m.portrait, 'pf')}</i>`).join('')
        : '<i class="st-face empty">—</i>'}</span>
      <span class="st-ls">${members.length
        ? `<b>${ls ? ls.name : '—'}</b><i>${ls ? ls.desc : ''}</i>`
        : '<b>未編成</b><i>キャラクター → 編成 で設定できます</i>'}</span>`;
    if (members.length) {
      row.addEventListener('click', () => {
        setTeamIndex(i);
        goStep('support');
      });
    }
    box.appendChild(row);
  }
  // 1つも編成していないと先へ進めないので、行き先を示しておく
  if (!charactersOfTeam(0).length && !hasAnyTeam()) {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'btn secondary block mt8';
    hint.textContent = 'キャラクターを編成しにいく';
    hint.addEventListener('click', () => { closeSortie(); showScreen('character'); });
    box.appendChild(hint);
  }
}

/** どれか1つでも中身のあるプリセットがあるか */
function hasAnyTeam() {
  for (let i = 0; i < TEAM_PRESETS; i++) if (charactersOfTeam(i).length) return true;
  return false;
}

/* --- 2. サポート選択 --- */
async function openSupportPick() {
  const stage = pendingStage;
  friendRentals = null;
  strangerRentals = null;
  // フレンドが1人もいなければ最初からNPCタブを開く
  supportTab = state.profile.friends.length ? 'friend' : 'npc';
  renderSupportList();

  const [rentals, strangers] = await Promise.all([
    fetchFriendRentals(),
    strangerRentals === null ? fetchStrangerRentals() : Promise.resolve(strangerRentals)
  ]);
  if (pendingStage !== stage) return;   // モーダルを閉じた後に返ってきたら無視
  friendRentals = rentals;
  strangerRentals = strangers;
  renderSupportList();
}

/** サポート候補1件ぶんの行を作る */
function supportRow(ch, ownerName, ownerIcon, isNpc, note, ownerUid) {
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
        ${ch.awaken ? awakenPipsHTML(ch.awaken, ch.awakenMax || 4) : ''}
        <span class="owner">${ownerIcon || '🙂'} ${ownerName}</span></div>
      <div class="cstats"><b>ATK</b>${ch.atk} <b>HP</b>${ch.hp} <b>RCV</b>${ch.rcv}</div>
      <div class="cskills"><span class="mini-tag ls">LS</span>${ls ? ls.name : '—'}
        <span class="ls-desc">${ls ? ls.desc : ''}</span></div>
      ${note ? `<div class="mstats">${note}</div>` : ''}
    </div>
    <button class="btn selbtn">選ぶ</button>`;
  row.querySelector('button').addEventListener('click', () => {
    pickSupport({ ...ch, isSupport: true, isNpc, ownerName, ownerIcon, ownerUid });
  });
  return row;
}

function renderSupportList() {
  $('supTabFriendBtn').classList.toggle('active', supportTab === 'friend');
  $('supTabOtherBtn').classList.toggle('active', supportTab === 'other');
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

  // フレンドではない他のプレイヤー。借りるとクリア後にフレンド登録を聞く
  if (supportTab === 'other') {
    if (strangerRentals === null) { box.innerHTML = '<div class="empty">読み込み中…</div>'; return; }
    if (!strangerRentals.length) {
      box.innerHTML = '<div class="empty">今は他のプレイヤーが見つかりませんでした。</div>';
      return;
    }
    strangerRentals.forEach(f => {
      const ch = resolveCharacter(f.charId, f.star, f.lv, f.awa);
      if (!ch) return;
      box.appendChild(supportRow(ch, f.name, f.icon, false, 'クリア後にフレンド登録できます', f.uid));
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

function pickSupport(support) {
  pendingSupport = support;
  goStep('confirm');
}

/* --- 3. 編成の確認 --- */
function renderSortieConfirm() {
  const members = charactersOfTeam(state.teamIndex);
  const lineup = members.map((m, i) => lineupCard(m, i === 0 ? 'リーダー' : 'サブ' + i, ''));
  lineup.push(pendingSupport
    ? lineupCard(pendingSupport, 'サポート', pendingSupport.ownerName || '')
    : `<div class="sl-card empty"><span class="sl-role">サポート</span>
         <span class="sl-face">—</span><span class="sl-name">なし</span></div>`);
  $('sortieLineup').innerHTML = lineup.join('');

  // リーダースキルは自陣リーダーとサポートの2つだけが乗る
  const own = members.length ? members[0].leaderSkill : null;
  const sup = pendingSupport ? pendingSupport.leaderSkill : null;
  const totalHP = members.reduce((s, m) => s + m.hp, 0) + (pendingSupport ? pendingSupport.hp : 0);
  const auras = [...new Set([...members, ...(pendingSupport ? [pendingSupport] : [])].map(m => m.aura))]
    .map(a => `<span class="aura-chip" style="--aura:${COLOR_HEX[AURAS[a].key]}">${AURAS[a].emoji}${AURAS[a].name}</span>`)
    .join('');
  const cost = staminaCost(pendingStage, pendingHard);
  $('sortieSummary').innerHTML = `
    <div class="ts-row"><span>攻撃できるオーラ</span><b class="aura-chips">${auras}</b></div>
    <div class="ts-row"><span>4人のHP合計</span><b>${totalHP}</b></div>
    <div class="ts-row"><span>消費スタミナ</span><b>${itemIcon('stamina')}${cost}</b></div>
    <div class="skill-line on"><span class="skill-tag ls">LS</span>
      <span><b>${own ? own.name : '—'}</b><br>${own ? own.desc : ''}</span></div>
    <div class="skill-line on"><span class="skill-tag ls">SUP</span>
      <span><b>${sup ? sup.name : 'サポートなし'}</b><br>${sup ? sup.desc : ''}</span></div>`;
}

function lineupCard(ch, role, owner) {
  const aura = AURAS[ch.aura];
  return `<div class="sl-card" style="--aura:${COLOR_HEX[aura.key]}">
    <span class="sl-role">${role}</span>
    <span class="sl-face">${charIcon(ch.art && ch.art.icon, ch.portrait, 'sl')}</span>
    <span class="sl-name">${ch.name}</span>
    <span class="sl-lv">Lv${ch.level}${owner ? ` ・ ${owner}` : ''}</span>
  </div>`;
}

/** 突入。ここではじめてスタミナを払う */
function startPendingRun() {
  const stage = pendingStage, hard = pendingHard, support = pendingSupport;
  if (!stage) return;
  if (!isAvailable(stage)) { toast('開催期間が終了しました'); closeSortie(); return; }
  const members = charactersOfTeam(state.teamIndex);
  if (!members.length) { toast('先にキャラクターを編成してください'); goStep('team'); return; }
  const cost = staminaCost(stage, hard);
  if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
  if (!spendStamina(cost)) { updateStatusBar(); return; }
  // ホームに出すのは「最後に連れて行った3人」
  rememberLastTeam(members.map(m => m.id));
  closeSortie();
  updateStatusBar();
  startDungeonRun(stage, hard, support);
}

/* ===================== ステージ一覧 ===================== */
/* 通常とテクニカルは「章(階層)ごとに5ステージ、前の章の最終ステージを
   ノーマルでクリアすると次が開く」という同じ形なので、名前と件数だけ
   差し替えて同じ処理を使う。 */
const SERIES = {
  story: {
    stages: () => STAGES, count: CHAPTER_COUNT,
    nameOf: chapterNameOf, lastId: chapterLastStageId,
    get: () => chapter, set: c => { chapter = c; }
  },
  technical: {
    stages: () => TECHNICAL_STAGES, count: TECH_CHAPTER_COUNT,
    nameOf: techChapterNameOf, lastId: techChapterLastStageId,
    get: () => techChapter, set: c => { techChapter = c; }
  }
};
/** 章タブを出す種別か */
function chaptered(mode) { return !!SERIES[mode]; }

/** その章が解禁されているか(前の章の最終ステージをノーマルでクリア) */
export function chapterUnlocked(ch, mode = 'story') {
  if (ch <= 1) return true;
  return !!(state.progress[SERIES[mode].lastId(ch - 1)] || {}).normal;
}

/** 解禁済みのいちばん先の章 */
function latestChapter(mode) {
  let last = 1;
  for (let c = 1; c <= SERIES[mode].count; c++) if (chapterUnlocked(c, mode)) last = c;
  return last;
}

function renderChapterBar(mode) {
  const series = SERIES[mode];
  const bar = $('chapterBar');
  bar.innerHTML = '';
  for (let c = 1; c <= series.count; c++) {
    const ok = chapterUnlocked(c, mode);
    const b = document.createElement('button');
    b.className = 'chapter-btn' + (c === series.get() ? ' active' : '') + (ok ? '' : ' locked');
    b.innerHTML = ok ? `<b>${c}</b><span>${series.nameOf(c)}</span>` : `<b>${c}</b><span>🔒</span>`;
    if (ok) b.addEventListener('click', () => { series.set(c); renderDungeon({ preserve: true }); });
    bar.appendChild(b);
  }
}

export function renderDungeon(options = {}) {
  if (!options.preserve) dungeonView = 'menu';
  // ホームのバナーなどから、種別選択を飛ばして直接開く
  if (options.mode) { dungeonMode = options.mode; dungeonView = 'stages'; }
  const choosing = dungeonView === 'menu';
  $('dungeonMenu').hidden = !choosing;
  renderResumeCard();
  $('dungeonStages').hidden = choosing;
  if (choosing) return;

  // 章タブと難易度切り替えは、通常とテクニカルで共通に使う
  $('storyControls').hidden = !chaptered(dungeonMode);
  $('dailyHead').hidden = dungeonMode !== 'daily';

  if (dungeonMode === 'daily') { renderDailyList(); return; }
  if (dungeonMode === 'raid') {
    const list=$('stageList');list.innerHTML='';renderStageCards(list,RAID_STAGES.filter(s=>s.raid && isAvailable(s)));return;
  }

  const series = SERIES[dungeonMode];
  $('diffNormalBtn').classList.toggle('active', !dungeonHard);
  $('diffHardBtn').classList.toggle('active', dungeonHard);
  if (!chapterUnlocked(series.get(), dungeonMode)) series.set(latestChapter(dungeonMode));
  renderChapterBar(dungeonMode);

  const list = $('stageList');
  list.innerHTML = '';
  renderStageCards(list, series.stages().filter(st => st.chapter === series.get()));
}

/* ===================== 曜日ダンジョン ===================== */
function renderDailyList() {
  const today = new Date().getDay();
  const theme = todayTheme();
  $('dailyHead').innerHTML = `
    <div class="daily-title">${dailyThemeIcon(theme)} ${theme.title}<span class="daily-day">${theme.label}曜</span></div>
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
    const hard = stage.daily || stage.raid ? false : dungeonHard;
    let isLocked;
    if (stage.raid) { isLocked=false; }
    else if (stage.daily) {
      isLocked = state.rank < stage.requireRank;
    } else {
      // 通常もテクニカルも「1つ前のステージをノーマルでクリア」で開く。
      // ハードはそのステージ自身をノーマルでクリアしてから
      const series = stage.technical ? TECHNICAL_STAGES : STAGES;
      const idx = series.findIndex(x => x.id === stage.id);
      const prev = idx > 0 ? series[idx - 1] : null;
      const unlockedNormal = !prev || (state.progress[prev.id] || {}).normal;
      isLocked = hard ? prog.normal !== true : !unlockedNormal;
    }
    const cleared = hard ? prog.hard : prog.normal;
    const cost = staminaCost(stage, hard);
    const enough = state.stamina >= cost;
    const rewardCoin = Math.round(stage.coinReward * (hard ? HARD_REWARD_MULT : 1));
    const orb = stage.orbReward
      ? ` ${itemIcon('orb')}${hard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward}` : '';
    // 初クリアぶんは、まだ取っていないときだけ出す
    const firstOrb = stage.firstClearOrb && !cleared
      ? ` <span class="first-orb">初${itemIcon('orb')}${stage.firstClearOrb}</span>` : '';
    const record = state.records[stage.id + '_' + (hard ? 'hard' : 'normal')];
    const dropText = dropLabel(stage);

    const div = document.createElement('div');
    div.className = 'stage-card' + (isLocked ? ' locked' : '') + (cleared ? ' cleared' : '');
    div.innerHTML = `
      <div class="stage-emoji">${(() => { const last=stage.floors.at(-1); const b=last.enemies?.[0] || last;
        return artImg(b.sprite, b.emoji, 'senemy'); })()}</div>
      <div class="sinfo">
        <div class="sname">${stage.name}${hard ? '<span class="hardtag">HARD</span>' : ''}
          ${cleared ? '<span class="clearbadge">CLEAR</span>' : ''}</div>
        <div class="ssub">${auraChips(stage)} ・ ${itemIcon('coin')}${rewardCoin}${orb}${firstOrb}</div>
        <div class="ssub dim">${dropText} ・ ${isLocked && stage.daily ? `ランク${stage.requireRank}で解放`
          : (record ? `最高コンボ ${record.maxChain}` : '未挑戦')}</div>
      </div>
      <div class="scost">
        <span class="stcost${enough || isLocked ? '' : ' short'}">${itemIcon('stamina')}${cost}</span>
        <span class="starrow">${isLocked ? '🔒' : '▶'}</span>
      </div>`;

    if (!isLocked) {
      div.addEventListener('click', () => {
        if (!hasStamina(cost)) { toast(`スタミナが足りません(必要 ${cost})`); updateStatusBar(); return; }
        openSortie(stage, hard);
      });
    }
    list.appendChild(div);
  });
}

/**
 * 盤面のオーブと同じ形。小さな丸は色だけだと火と癒が似て見えるので、
 * バトルと同じグリフを載せて形でも区別できるようにしている。
 * (座標は renderer.js の drawGlyph を 24x24 に写したもの)
 */
const AURA_GLYPH = {
  c0: '<path d="M12 5.7Q17.5 11.5 15.4 15Q12 18.3 8.6 15Q6.5 11.5 12 5.7Z"/>',
  c1: '<path d="M12 5.7Q17.2 13.1 12 18.1Q6.8 13.1 12 5.7Z"/>',
  c2: '<path d="M6.5 16.1Q10.9 5.1 17.5 7.9Q13.1 18.9 6.5 16.1Z"/>',
  c3: '<path d="M6.2 10.1h11.6v3.8H6.2zM10.1 6.2h3.8v11.6h-3.8z"/>',
  c4: '<path fill-rule="evenodd" d="M6.4 12a5.6 5.6 0 1 1 11.2 0a5.6 5.6 0 1 1 -11.2 0'
    + 'M10 10.5a5.1 5.1 0 1 1 10.2 0a5.1 5.1 0 1 1 -10.2 0Z"/>'
};

/**
 * そのステージの盤面に出るオーラ。
 * 1〜2章は4色、3章から闇が加わるので、どの色が落ちてくるかをここで示す。
 */
function auraChips(stage) {
  const list = stage.auras || BASE_AURAS;
  return `<span class="aura-dots">${list.map(a => {
    const au = AURAS[a];
    return `<i class="aura-dot" style="--aura:${COLOR_HEX[au.key]}" title="${au.name}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${AURA_GLYPH[au.key] || ''}</svg></i>`;
  }).join('')}</span>`;
}

/** そのステージで何が手に入るかの1行表示 */
function dropLabel(stage) {
  if(stage.raid)return raidDropSummaryHTML(stage);
  if (stage.technical) {
    const mat = materialById(crystalIdFor(stage.dropAura));
    return `全フロア特殊行動 ・ ${itemIcon(mat.id)}${mat.name}`;
  }
  if (stage.dropType === 'gold') return `${itemIcon('coin')} ゴールド特化`;
  if (stage.dropType === 'exp') return `${itemIcon('mt_exp2')} キャラ経験値アイテム`;
  const mat = materialById(crystalIdFor(stage.dropAura));
  return `${itemIcon(mat.id)}${mat.name} ドロップ`;
}

function dailyThemeIcon(theme) {
  if (theme.dropType === 'gold') return itemIcon('coin');
  if (theme.dropType === 'exp') return itemIcon('mt_exp2');
  return itemIcon(crystalIdFor(theme.dropAura));
}
