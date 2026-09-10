/* =========================================================
 * battle.js — ダンジョン進行とバトル制御
 * フロアは「次へ」ボタンなしで自動的に進む(フロア間の回復なし)。
 * =======================================================*/
import { $, sleep, randInt, toast } from '../core/ui.js';
import { state, saveState, getTeamStats, gainExp } from '../core/state.js';
import { showScreen, currentScreen, updateStatusBar } from '../core/nav.js';
import { setRetreatHandler } from '../core/sysmodal.js';
import {
  COLOR_HEX, ELEMENTS, HEAL_COLOR,
  FLOORS_PER_STAGE, HARD_HP_MULT, HARD_REWARD_MULT
} from '../data/gamedata.js';
import { COLS, ROWS, genBoard, findGroups, applyGravityNoRefill, refillBoard } from './board.js';
import { initRenderer, resizeBoard, drawBoard, CELL } from './renderer.js';

const DRAG_TIME = 12000;   // オーブを動かせる制限時間(ms)

let canvas;
let board = [];
let bstate = 'idle';       // idle | dragging | resolving | over
let selected = null, floatPos = null, dragStart = 0, autoReleased = false;
let clearingCells = [];
let run = null;

/* ===================== 起動 ===================== */
export function initBattle() {
  canvas = $('board');
  initRenderer(canvas);
  resizeBoard();
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', () => { if (currentScreen === 'battle') resizeBoard(); });
  setRetreatHandler(retreat);
  $('resultBtn').addEventListener('click', () => {
    $('resultModal').classList.remove('show');
    showScreen('dungeon', false);
  });
  requestAnimationFrame(loop);
}

/* ===================== 描画ループ ===================== */
function loop(t) {
  if (currentScreen === 'battle' && run) {
    drawBoard({ board, t, selected, floatPos, dragging: bstate === 'dragging', clearingCells });
    if (bstate === 'dragging' && !autoReleased) {
      const remain = Math.max(0, DRAG_TIME - (t - dragStart));
      $('timerFill').style.width = (remain / DRAG_TIME * 100) + '%';
      $('timerNum').textContent = (remain / 1000).toFixed(1) + 's';
      if (remain <= 0) { autoReleased = true; selected = null; floatPos = null; resolveTurn(); }
    }
  }
  requestAnimationFrame(loop);
}

/* ===================== ラン開始 ===================== */
export function startDungeonRun(stage, hard) {
  const ts = getTeamStats();
  if (!ts.mons.length) { toast('チームにモンスターを編成してください'); showScreen('monster'); return; }
  run = {
    stage, hard, floorIndex: 0,
    maxHP: ts.maxHP, atkMult: ts.atkMult, leaderElement: ts.leaderElement, mons: ts.mons,
    playerHP: ts.maxHP,
    stats: { maxChain: 0, totalDamage: 0, totalHeal: 0, turns: 0 }
  };
  renderParty();
  loadFloor();
  showScreen('battle');
  resizeBoard();
}

function renderParty() {
  const row = $('partyRow');
  row.innerHTML = '';
  run.mons.forEach((m, i) => {
    const el = ELEMENTS[m.element];
    const div = document.createElement('div');
    div.className = 'party-unit' + (i === 0 ? ' leader' : '');
    div.style.setProperty('--unit-color', COLOR_HEX[el.key]);
    div.innerHTML = `<div class="unit-icon">${el.emoji}</div>
      <div class="unit-atk">${m.atk}</div>`;
    row.appendChild(div);
  });
}

function loadFloor() {
  const floor = run.stage.floors[run.floorIndex];
  run.enemyMaxHP = Math.round(floor.hp * (run.hard ? HARD_HP_MULT : 1));
  run.enemyHP = run.enemyMaxHP;
  run.enemyAtk = Math.round(floor.atk * (run.hard ? HARD_HP_MULT : 1));
  run.enemyInterval = floor.interval;
  run.enemyTurnsLeft = floor.interval;

  $('enemyEmoji').textContent = floor.emoji;
  $('enemyName').textContent = floor.name;
  $('floorIndicator').innerHTML =
    `<span>${run.stage.name}${run.hard ? ' (ハード)' : ''}</span>` +
    `<span>フロア ${run.floorIndex + 1}/${FLOORS_PER_STAGE}</span>`;
  board = genBoard();
  bstate = 'idle';
  clearingCells = [];
  hideBanner();
  $('timerFill').style.width = '0%';
  $('timerNum').textContent = (DRAG_TIME / 1000).toFixed(1) + 's';
  updateHPUI(false, false);
}

/* ===================== HP表示 ===================== */
function updateHPUI(flashEnemy, flashPlayer) {
  $('enemyHPFill').style.width = Math.max(0, run.enemyHP / run.enemyMaxHP * 100) + '%';
  $('enemyHPText').textContent = Math.max(0, run.enemyHP) + ' / ' + run.enemyMaxHP;
  $('playerHPFill').style.width = Math.max(0, run.playerHP / run.maxHP * 100) + '%';
  $('playerHPText').textContent = Math.max(0, run.playerHP) + ' / ' + run.maxHP;
  $('enemyTurnCount').textContent = run.enemyTurnsLeft;
  if (flashEnemy) flash($('enemyStage'));
  if (flashPlayer) flash($('partyBox'));
}
function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

function showBanner(html) { $('banner').innerHTML = html; $('banner').classList.add('show'); }
function hideBanner() { $('banner').classList.remove('show'); }

/* ===================== ターン解決 ===================== */
async function resolveTurn() {
  bstate = 'resolving';
  $('timerFill').style.width = '0%';
  run.stats.turns++;

  let chain = 0, turnDamage = 0, turnHeal = 0;
  while (true) {
    const groups = findGroups(board);
    if (groups.length === 0) break;
    chain++;
    const simulBonus = 1 + 0.3 * (groups.length - 1);
    const chainMult = 1 + (chain - 1) * 1.5;

    let stepBase = 0, stepHealBase = 0;
    groups.forEach(g => {
      const isHeal = g.color === HEAL_COLOR;
      let v = g.cells.length * (isHeal ? 12 : 10);
      if (run.leaderElement !== null && g.color === run.leaderElement) v *= 1.3;
      if (isHeal) stepHealBase += v; else stepBase += v;
    });
    const stepDamage = Math.round(stepBase * simulBonus * chainMult * run.atkMult);
    const stepHeal = Math.round(stepHealBase * simulBonus * chainMult);
    turnDamage += stepDamage;
    turnHeal += stepHeal;

    let html = `<span class="chain">${chain}コンボ</span>`;
    if (stepDamage > 0) html += ` <span class="dmg">${stepDamage}ダメージ!</span>`;
    if (stepHeal > 0) html += ` <span class="heal">+${stepHeal}回復</span>`;
    if (groups.length > 1) html += ` <span class="simul">(同時${groups.length}消し)</span>`;
    showBanner(html);

    clearingCells = groups.flatMap(g => g.cells);
    await sleep(240);
    groups.forEach(g => g.cells.forEach(([r, c]) => { board[r][c] = -1; }));
    clearingCells = [];
    await sleep(110);
    applyGravityNoRefill(board);
    await sleep(200);
  }

  run.stats.maxChain = Math.max(run.stats.maxChain, chain);
  run.stats.totalDamage += turnDamage;
  run.stats.totalHeal += turnHeal;

  if (turnHeal > 0) {
    run.playerHP = Math.min(run.maxHP, run.playerHP + turnHeal);
  }
  if (turnDamage > 0) {
    run.enemyHP = Math.max(0, run.enemyHP - turnDamage);
  }
  updateHPUI(turnDamage > 0, turnHeal > 0);
  await sleep(320);

  if (run.enemyHP <= 0) { hideBanner(); await floorClear(); return; }

  // 盤面が枯れて詰まないよう空きマスを補充する
  if (refillBoard(board) > 0) await sleep(180);

  if (chain === 0) showBanner('<span class="miss">不発...</span>');

  // 敵の攻撃カウント
  run.enemyTurnsLeft--;
  if (run.enemyTurnsLeft <= 0) {
    const dmg = Math.max(1, run.enemyAtk + randInt(-2, 4));
    run.playerHP = Math.max(0, run.playerHP - dmg);
    run.enemyTurnsLeft = run.enemyInterval;
    showBanner(`<span class="miss">敵の攻撃!</span> ${dmg}ダメージ`);
    updateHPUI(false, true);
    await sleep(700);
  }
  hideBanner();
  updateHPUI(false, false);

  if (run.playerHP <= 0) { battleDefeat(); return; }
  bstate = 'idle';
}

/* ===================== フロア進行 ===================== */
async function floorClear() {
  bstate = 'resolving';
  const isLast = run.floorIndex >= FLOORS_PER_STAGE - 1;
  if (isLast) { finishRun(); return; }
  // ボタンなしで自動的に次のフロアへ(体力回復はなし)
  showBanner('<span class="chain">フロアクリア!</span> 次のフロアへ…');
  await sleep(1000);
  run.floorIndex++;
  loadFloor();
  showBanner(`<span class="chain">フロア ${run.floorIndex + 1}</span>`);
  await sleep(700);
  hideBanner();
  bstate = 'idle';
}

/* ===================== リザルト ===================== */
function finishRun() {
  bstate = 'over';
  const { stage, hard, stats } = run;
  const prog = state.progress[stage.id] = state.progress[stage.id] || {};
  if (hard) prog.hard = true; else prog.normal = true;

  const coin  = Math.round(stage.coinReward  * (hard ? HARD_REWARD_MULT : 1));
  const frepo = Math.round(stage.frepoReward * (hard ? HARD_REWARD_MULT : 1));
  const orb   = hard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward;
  const exp   = Math.round(stage.expReward * (hard ? HARD_REWARD_MULT : 1));
  state.coin += coin; state.frepo += frepo; state.orb += orb;

  const key = stage.id + '_' + (hard ? 'hard' : 'normal');
  const rec = state.records[key] || { maxChain: 0 };
  const isNewRecord = stats.maxChain > rec.maxChain;
  if (isNewRecord) rec.maxChain = stats.maxChain;
  state.records[key] = rec;
  saveState();

  const rankUps = gainExp(exp);

  $('resultTitle').textContent = 'STAGE CLEAR';
  $('resultStats').innerHTML = `
    <div class="rstat"><span>最高連鎖</span><b>${stats.maxChain} コンボ${isNewRecord ? ' <span class="rnew">NEW!</span>' : ''}</b></div>
    <div class="rstat"><span>与ダメージ合計</span><b>${stats.totalDamage}</b></div>
    <div class="rstat"><span>回復量合計</span><b>${stats.totalHeal}</b></div>
    <div class="rstat"><span>ターン数</span><b>${stats.turns}</b></div>
    <div class="rstat"><span>残りHP</span><b>${run.playerHP} / ${run.maxHP}</b></div>`;
  $('resultRewards').innerHTML = `
    <div class="rrow">💰 <b>${coin}</b></div>
    <div class="rrow">🎗️ <b>${frepo}</b></div>
    ${orb ? `<div class="rrow">💎 <b>${orb}</b></div>` : ''}
    <div class="rrow">⭐ <b>EXP ${exp}</b></div>`;
  $('resultRank').innerHTML = rankUps > 0
    ? `<div class="rankup">🎉 ランクアップ! Rank ${state.rank}<br><span>スタミナ上限アップ&全回復!</span></div>`
    : '';
  $('resultModal').classList.add('show');
  updateStatusBar();
  run = null;
}

function battleDefeat() {
  bstate = 'over';
  $('resultTitle').textContent = 'DEFEAT';
  $('resultStats').innerHTML = `
    <div class="rstat"><span>到達フロア</span><b>${run.floorIndex + 1} / ${FLOORS_PER_STAGE}</b></div>
    <div class="rstat"><span>最高連鎖</span><b>${run.stats.maxChain} コンボ</b></div>
    <div class="rstat"><span>与ダメージ合計</span><b>${run.stats.totalDamage}</b></div>`;
  $('resultRewards').innerHTML = '<div class="rrow rnone">HPが尽きた…報酬なし</div>';
  $('resultRank').innerHTML = '';
  $('resultModal').classList.add('show');
  run = null;
}

function retreat() {
  if (bstate === 'resolving') return;
  bstate = 'over';
  run = null;
  showScreen('dungeon', false);
}

/* ===================== 入力 ===================== */
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function onPointerDown(e) {
  if (bstate !== 'idle' || !run) return;
  const { x, y } = getPos(e);
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (board[r][c] === -1) return;
  bstate = 'dragging';
  selected = { r, c };
  floatPos = { x, y };
  dragStart = performance.now();
  autoReleased = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
}
function onPointerMove(e) {
  if (bstate !== 'dragging' || !selected) return;
  let { x, y } = getPos(e);
  const half = CELL * 0.5;
  x = Math.max(half - 1, Math.min(CELL * COLS - half + 1, x));
  y = Math.max(half - 1, Math.min(CELL * ROWS - half + 1, y));
  floatPos = { x, y };
  const c = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
  const r = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)));
  if (r !== selected.r || c !== selected.c) {
    const tmp = board[r][c];
    board[r][c] = board[selected.r][selected.c];
    board[selected.r][selected.c] = tmp;
    selected = { r, c };
  }
}
function onPointerUp() {
  if (bstate !== 'dragging' || autoReleased) return;
  autoReleased = true;
  selected = null;
  floatPos = null;
  resolveTurn();
}
