/* =========================================================
 * battle.js — ダンジョン進行とバトル制御
 *
 * 【新しい戦闘ルール】
 *  - 自陣は人物キャラクター3人 + サポート1人(フレンド or NPC)の計4人。
 *  - 各キャラは固有の「オーラ」を持ち、そのオーラを消したときだけ攻撃する。
 *    自分のオーラが1つも消えていないキャラは攻撃しない。
 *  - 消した数が多いほどそのキャラの攻撃力が上がる。
 *  - 癒オーラのキャラは攻撃ではなく回復を行う。
 *  - 発動するリーダースキルは「自陣リーダー」と「サポート」の2つ。
 *  - オーラ操作の基本時間は10秒。リーダースキルとスキルで延長して戦う。
 * =======================================================*/
import { $, sleep, randInt, toast, artImg, charIcon, itemIcon } from '../core/ui.js';
import {
  state, saveState, gainExp, maxStamina, gainCharExp, addMaterials, addCharacter, ownCharacters
} from '../core/state.js';
import { showScreen, currentScreen, updateStatusBar } from '../core/nav.js';
import { setRetreatHandler } from '../core/sysmodal.js';
import { saveRunSnapshot, loadRunSnapshot, clearRunSnapshot } from './resume.js';
import { countRentalUse, addFriendByUid } from '../core/friends.js';
import {
  AURAS, COLORS, COLOR_HEX, HEAL_COLOR, RARITY_TITLE,
  HARD_HP_MULT, HARD_REWARD_MULT,
  MAX_DRAG_TIME, MATERIALS, materialById, crystalIdFor, resolveCharacter
} from '../data/gamedata.js';
import {
  COLS, ROWS, genBoard, findGroups, applyGravityNoRefill, refillBoard,
  convertColor, spawnColor, shuffleBoard, setPalette
} from './board.js';
import { buildParty } from './party.js';
import { initRenderer, resizeBoard, drawBoard, animateConversion, clearConversion, CELL } from './renderer.js';
import { createEnemyEffects, enterEnemy, applyEnemyEffect, tickEnemyEffects, effectiveTime, damageEnemy, enemyAction, poisonDamage } from './enemy-skills.js';
import { playEnemyMotion } from './enemy-motion.js';
import { renderEnemyShield } from './enemy-shield.js';
import { renderEnemyBadges } from './enemy-badges.js';
import { playPartyAttacks } from './party-motion.js';
import { createChanceBoard, isAllClear } from './chance.js';
import { baseActions, finalActions } from './damage.js';
import { chainBanner } from './chain-style.js';
import { createEncounter, attachEncounter, combatEnemy, encounterCleared, retarget, tickEncounter, summonClones, damageTarget } from './encounter.js';
import { bossTransition, bossDialogue } from './raid-presentation.js';
import { renderPlayerBadges } from './player-badges.js';
import { raidDropRate, rollRaidCharacter } from '../data/raids.js';
import { raidDropResultHTML } from '../data/raid-rewards.js';
import { rollCurrencyDrop } from '../data/event-drops.js';

let canvas;
let board = null;
let bstate = 'idle';       // idle | dragging | resolving | over
let selected = null, floatPos = null, dragStart = 0, autoReleased = false;
let grabbed = false;       // 操作時間内で「今まさに指がオーブを掴んでいるか」
let clearingCells = [], clearStart = 0;
let chainLabels = [];          // 盤面に浮かべる「N Chain」
let run = null;
let returnScreen = 'dungeon';
let pendingFriendUid = null, pendingFriendName = '';

/* ===================== 起動 ===================== */
export function initBattle() {
  canvas = $('board');
  initRenderer(canvas);
  resizeBoard();
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  // 操作時間が余っているときに待たされるのがつらいので、自分で締められるようにする
  $('fireNowBtn').addEventListener('click', endTurnNow);
  window.addEventListener('resize', () => { if (currentScreen === 'battle') resizeBoard(); });
  setRetreatHandler(retreat);
  $('resultAddFriendBtn').addEventListener('click', async () => {
    if (!pendingFriendUid) return;
    const btn = $('resultAddFriendBtn');
    btn.disabled = true; btn.textContent = '登録中…';
    let res;
    // 例外をそのまま落とすと、押したのに何も起きないように見える
    try { res = await addFriendByUid(pendingFriendUid, pendingFriendName); }
    catch (e) { res = { ok: false, message: 'フレンド登録に失敗しました。時間をおいてお試しください' }; }
    toast(res.message);
    if (res.ok) { $('resultFriendBox').hidden = true; pendingFriendUid = null; }
    else { btn.disabled = false; btn.textContent = 'フレンド登録する'; }
  });
  $('resultBtn').addEventListener('click', () => {
    $('resultModal').classList.remove('show');
    showScreen(returnScreen, { preserve: true });
  });
  $('battleInfoBtn').addEventListener('click', openPartyInfo);
  $('skillCancelBtn').addEventListener('click', closeSkillConfirm);
  $('skillUseBtn').addEventListener('click', () => {
    const i = pendingSkill;
    closeSkillConfirm();
    if (i !== null) applySkill(i);
  });
  $('partyInfoCloseBtn').addEventListener('click', () => $('partyInfoModal').classList.remove('show'));
  $('partyInfoModal').addEventListener('click', e => {
    if (e.target === $('partyInfoModal')) $('partyInfoModal').classList.remove('show');
  });
  requestAnimationFrame(loop);
}

/** 発火ボタンをいま出しているか(毎フレームDOMを触らないための覚え) */
let fireBtnShown = false;

/** そのターンに使える操作時間(ms) */
function dragTimeMs() {
  return effectiveTime(run.party.baseDragTime, run.turnTimeBonusMs, MAX_DRAG_TIME, run.enemyEffects);
}

/* ===================== 描画ループ ===================== */
function loop(t) {
  if (currentScreen === 'battle' && run) {
    const clearT = clearingCells.length ? (t - clearStart) / 260 : 0;
    const dragging = bstate === 'dragging' && !autoReleased;
    const total = dragTimeMs();
    const remain = dragging ? Math.max(0, total - (t - dragStart)) : 0;
    drawBoard({
      board, t, selected, floatPos, dragging: bstate === 'dragging',
      clearingCells, clearT, chainLabels, remainMs: dragging ? remain : null, totalMs: total,
      swapHint: run.chanceActive ? run.chanceHint : null,
      auraBinds: run.enemyEffects.auraBinds
    });
    // 時間内なら指を離しても手番は終わらず、別のオーブを掴み直して操作を続けられる
    if (dragging && remain <= 0) endTurnNow();
    // 発火ボタンは操作中だけ出す。毎フレーム触らないよう、変わったときだけ
    if (dragging !== fireBtnShown) {
      fireBtnShown = dragging;
      const btn = $('fireNowBtn');
      if (btn) btn.hidden = !dragging;
    }
  }
  requestAnimationFrame(loop);
}

/** 操作を打ち切って手番を解決する。時間切れと「発火」ボタンの共通の出口 */
function endTurnNow() {
  if (bstate !== 'dragging' || autoReleased) return;
  autoReleased = true; grabbed = false; selected = null; floatPos = null;
  const btn = $('fireNowBtn');
  if (btn) { btn.hidden = true; fireBtnShown = false; }
  resolveTurn();
}

/* ===================== ラン開始 ===================== */
/**
 * @param {object} stage ステージ定義
 * @param {boolean} hard ハードモードか
 * @param {object|null} support サポート枠のキャラクター
 */
export function startDungeonRun(stage, hard, support) {
  returnScreen = stage.event ? 'event' : 'dungeon';
  setBattleBackground(stage);
  const party = buildParty(support);
  if (!party.own.length) { toast('チームにキャラクターを編成してください'); showScreen('character'); return; }

  run = {
    stage, hard, floorIndex: 0,
    party,
    mods: party.mods,
    matchMin: party.matchMin,
    maxHP: party.maxHP,
    playerHP: party.maxHP,
    cooldowns: party.members.map(m => {
      const sk = m.skill;
      return sk ? Math.ceil(sk.cooldown * 0.6) : 0;
    }),
    buffs: { atk: null, guard: null },
    enemyEffects: createEnemyEffects(party.members.length),
    chancePending: false,
    chanceActive: false,
    chanceHint: null,
    enemies: createEncounter(stage.floors[0], hard ? HARD_HP_MULT : 1), targetIndex: 0,
    turnTimeBonusMs: 0,
    stats: { maxChain: 0, totalDamage: 0, totalHeal: 0, turns: 0, skillUses: 0 }
  };
  attachEncounter(run);
  resetFoeCards();
  clearRunSnapshot();           // 別のダンジョンに入ったら前の中断データは無効
  // 誰かの貸し出しキャラを借りたら、その人の使用回数を1つ増やす(相手は翌日フレポを受け取る)
  if (support && support.ownerUid) countRentalUse(support.ownerUid);

  // 盤面に出るオーラはステージごと(3章から闇が加わる)
  setPalette(stage.auras);
  board = null;                 // 新しいダンジョンでは盤面を作り直す
  renderParty();
  showScreen('battle', { bgm: stage.bgm });
  loadFloor();
  resizeBoard();
}

/* ===================== 中断と再開 ===================== */
/** キャラ1人を、あとから resolveCharacter で組み直せる形にする */
const memberRef = m => ({ id: m.id, star: m.star, level: m.level, awaken: m.awaken });

/** 中断したときの3人と、いまの編成が違うか(知らせるためだけに使う) */
function teamChangedSince(own) {
  const now = ownCharacters();
  return own.length !== now.length || own.some((m, i) => m.id !== now[i].id);
}

/**
 * 手番の切れ目で進行状況を保存する。
 * 自陣の3人も控える。ここを編成から作り直すと、中断中にチームを
 * 入れ替えられたときに別の面子で再開してしまう。
 */
function persistRun() {
  if (!run) return;
  const sup = run.party.support;
  saveRunSnapshot({
    stage: run.stage, hard: run.hard, floorIndex: run.floorIndex,
    own: run.party.own.map(memberRef),
    support: sup ? {
      id: sup.id, star: sup.star, level: sup.level, awaken: sup.awaken,
      isNpc: !!sup.isNpc, ownerName: sup.ownerName, ownerIcon: sup.ownerIcon, ownerUid: sup.ownerUid
    } : null,
    playerHP: run.playerHP,
    cooldowns: run.cooldowns,
    buffs: run.buffs,
    chancePending: run.chancePending,
    chanceActive: run.chanceActive,
    chanceHint: run.chanceHint,
    enemies: run.enemies,
    targetIndex: run.targetIndex,
    // 味方にかかっている妨害。enemyEffects のうち敵側の値は敵ごとに持っている
    playerEffects: {
      binds: run.enemyEffects.binds, auraBinds: run.enemyEffects.auraBinds, time: run.enemyEffects.time,
      recovery: run.enemyEffects.recovery, poison: run.enemyEffects.poison
    },
    stats: run.stats,
    board
  });
}

/** 手番を player に返すときは必ずここを通す(中断データもここで更新する) */
function goIdle() { bstate = 'idle'; persistRun(); }

/** 中断中のダンジョンがあるか */
export function pausedRun() {
  const snap = loadRunSnapshot();
  return snap ? { stage: snap.stage, hard: snap.hard, floorIndex: snap.floorIndex,
    playerHP: snap.playerHP, savedAt: snap.savedAt } : null;
}
export function discardPausedRun() { clearRunSnapshot(); }

/**
 * 中断したダンジョンを再開する。スタミナは消費済みなので取り直さない。
 * 敵の登場演出・セリフ・先制行動は適用済みなので、描画だけを作り直す。
 */
export function resumeDungeonRun() {
  const snap = loadRunSnapshot();
  if (!snap) return false;

  const s = snap.support;
  const support = s
    ? { ...resolveCharacter(s.id, s.star, s.level, s.awaken), isSupport: true, isNpc: !!s.isNpc,
        ownerName: s.ownerName, ownerIcon: s.ownerIcon, ownerUid: s.ownerUid }
    : null;
  // 入ったときの3人で再開する(中断中にチームを変えても、この潜行には効かない)
  const own = (snap.own || [])
    .map(m => resolveCharacter(m.id, m.star, m.level, m.awaken))
    .filter(Boolean);
  const party = buildParty(support, own);
  if (!party.own.length) { toast('チームにキャラクターを編成してください'); showScreen('character'); return false; }
  if (teamChangedSince(own)) toast('中断したときの編成で再開します');

  run = {
    stage: snap.stage, hard: snap.hard, floorIndex: snap.floorIndex,
    party, mods: party.mods, matchMin: party.matchMin,
    maxHP: party.maxHP,
    playerHP: Math.max(1, Math.min(party.maxHP, snap.playerHP || party.maxHP)),
    cooldowns: party.members.map((m, i) => Math.max(0, snap.cooldowns?.[i] ?? 0)),
    buffs: snap.buffs || { atk: null, guard: null },
    enemyEffects: createEnemyEffects(party.members.length),
    chancePending: !!snap.chancePending,
    chanceActive: !!snap.chanceActive,
    // 中断から戻ったときも光は残す。形が壊れていても renderer 側で弾く
    chanceHint: snap.chanceHint || null,
    enemies: snap.enemies,
    targetIndex: Math.max(0, Math.min(snap.enemies.length - 1, snap.targetIndex || 0)),
    turnTimeBonusMs: 0,
    stats: snap.stats || { maxChain: 0, totalDamage: 0, totalHeal: 0, turns: 0, skillUses: 0 }
  };
  const pe = snap.playerEffects || {};
  run.enemyEffects.auraBinds = pe.auraBinds || {};
  run.enemyEffects.time = pe.time ?? null;
  run.enemyEffects.recovery = pe.recovery ?? null;
  run.enemyEffects.poison = pe.poison ?? null;
  for (let i = 0; i < party.members.length; i++) run.enemyEffects.binds[i] = pe.binds?.[i] || 0;
  attachEncounter(run);
  resetFoeCards();

  setPalette(run.stage.auras);
  board = Array.isArray(snap.board) && snap.board.length ? snap.board : genBoard(run.matchMin);
  renderParty();
  returnScreen = run.stage.event ? 'event' : 'dungeon';
  setBattleBackground(run.stage);
  showScreen('battle', { bgm: run.stage.bgm });
  restoreFloor();
  return true;
}

function setBattleBackground(stage) {
  const panel = $('enemyStage');
  if (!stage.battleBackground) { panel.style.removeProperty('--battle-bg-image'); return; }
  const url = new URL(stage.battleBackground, document.baseURI);
  panel.style.setProperty('--battle-bg-image', `url("${url.href}")`);
}

/** 再開時の画面づくり。loadFloor から演出と先制行動を除いたもの。 */
function restoreFloor() {
  bstate = 'resolving';
  clearConversion();
  run.actingEnemy = null;
  $('enemyStage').classList.toggle('multi-enemy', !!run.stage.raid);
  $('screenTitle').textContent = run.stage.name + (run.hard ? ' / ハード' : '');
  renderFloorPips();
  grabbed = false;
  clearingCells = [];
  chainLabels = [];
  run.turnTimeBonusMs = 0;
  hideBanner();
  resetTimerUI();
  updateChanceUI();
  updateHPUI(false, false);
  updateSkillUI();
  resizeBoard();
  goIdle();
}

/* ===================== パーティ表示 ===================== */
function renderParty() {
  const row = $('partyRow');
  row.innerHTML = '';
  run.party.members.forEach((m, i) => {
    const aura = AURAS[m.aura];
    const btn = document.createElement('div');
    btn.className = 'unit r' + m.rarity + (m.isSupport ? ' support' : '');
    btn.dataset.idx = String(i);
    btn.title = m.isSupport ? `${m.name}(${m.ownerName || 'サポート'}から)` : m.name;
    btn.style.setProperty('--aura', COLOR_HEX[aura.key]);
    btn.innerHTML = `<button type="button" class="unit-skill" aria-label="${m.name}のスキル">
      <span class="unit-pops"></span>
      <span class="unit-pending" hidden></span>
      <span class="unit-ready-burst" hidden>スキル準備完了！</span>
      <span class="unit-face">
        <span class="unit-portrait">${charIcon(m.art && m.art.icon, m.portrait, 'unit')}</span>
        <span class="unit-cd" hidden></span>
      </span></button><span class="unit-statuses" aria-label="個別の状態効果"></span>`;
    btn.querySelector('.unit-skill').addEventListener('click', () => confirmSkill(i));
    row.appendChild(btn);
  });
  updateSkillUI();
}

function updateSkillUI() {
  const units = $('partyRow').children;
  run.party.members.forEach((m, i) => {
    const unit = units[i];
    if (!unit) return;
    const sk = m.skill;
    const cd = run.cooldowns[i];
    const bound = run.enemyEffects.binds[i];
    const ready = sk && cd <= 0 && !bound;
    const becameReady = ready && !unit.classList.contains('ready');
    const burst = unit.querySelector('.unit-ready-burst');
    if (!ready) { burst.hidden = true; unit.classList.remove('skill-awaken'); }
    if (becameReady) {
      burst.hidden = false;
      unit.classList.remove('skill-awaken'); void unit.offsetWidth; unit.classList.add('skill-awaken');
      clearTimeout(unit.readyTimer);
      unit.readyTimer = setTimeout(() => { burst.hidden = true; unit.classList.remove('skill-awaken'); }, 1800);
    }
    unit.classList.toggle('bound', !!bound);
    unit.classList.toggle('ready', !!ready);
    // 残りターンはアイコン角のバッジで示す(使えるようになったら消す)
    const badge = unit.querySelector('.unit-cd');
    if (!badge) return;
    badge.hidden = !sk || cd <= 0;
    badge.textContent = sk ? cd : '';
  });
  renderPlayerBadges(run);
}

/** キャラの上にダメージ/回復の数字を浮かせる */
function popUnit(i, text, kind) {
  const unit = $('partyRow').children[i];
  if (!unit) return;
  unit.classList.remove('acting'); void unit.offsetWidth; unit.classList.add('acting');
  const pops = unit.querySelector('.unit-pops');
  const el = document.createElement('span');
  el.className = 'pop ' + kind;
  el.textContent = text;
  pops.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* ===================== フロア ===================== */
async function loadFloor() {
  bstate = 'resolving';
  clearConversion();
  const floor = run.stage.floors[run.floorIndex];
  const reveal = floor.intro ? await bossTransition(floor.intro, floor) : null;
  run.enemies = createEncounter(floor, run.hard ? HARD_HP_MULT : 1);
  resetFoeCards();
  run.targetIndex = 0; run.actingEnemy = null;

  $('enemyStage').classList.toggle('multi-enemy', !!run.stage.raid);
  // ステージ名はトップバーに出す(画面上部を盤面のために空ける)
  $('screenTitle').textContent = run.stage.name + (run.hard ? ' / ハード' : '');
  renderFloorPips();
  // 最初のフロアだけ盤面を作る。以降は前のフロアの盤面を残し、
  // 消えて空いたところにだけオーラを補充する
  if (run.chancePending) activateChanceBoard();
  else if (!board) { board = genBoard(run.matchMin); updateChanceUI(); }
  else if (!run.chanceActive) { applyGravityNoRefill(board); refillBoard(board, run.matchMin); }
  bstate = 'resolving';
  grabbed = false;
  clearingCells = [];
  chainLabels = [];
  run.turnTimeBonusMs = 0;
  hideBanner();
  resetTimerUI();
  updateHPUI(false, false);
  updateSkillUI();
  if (reveal) await reveal();
  if (floor.dialogue) { const spec = combatEnemy(run).spec; await bossDialogue(spec.name, floor.dialogue, spec.sprite); }
  for (const enemy of [...run.enemies]) {
    run.actingEnemy=enemy;
    if (enemy.spec.enemySkills?.passives?.length) await playEnemyMotion(enemy.spec.enemySkills.passives, board);
    if (enemy.spec.enemySkills?.preemptive) await executeEnemyAction(enemy.spec.enemySkills.preemptive, true);
    if (run.playerHP<=0) break;
  }
  run.actingEnemy=null;updateHPUI(false,false);
  if (run.playerHP <= 0) { battleDefeat(); return; }
  goIdle();
}

function renderFloorPips() {
  const box = $('floorPips');
  box.innerHTML = '';
  for (let i = 0; i < run.stage.floors.length; i++) {
    const pip = document.createElement('span');
    pip.className = 'fpip'
      + (i < run.floorIndex ? ' done' : '')
      + (i === run.floorIndex ? ' now' : '')
      + (i === run.stage.floors.length - 1 ? ' boss' : '');
    box.appendChild(pip);
  }
}

function resetTimerUI() { /* 操作時間は盤面上に描くのでDOM側の更新は不要 */ }

/* ===================== HP表示 ===================== */
function updateHPUI(flashEnemy, flashPlayer) {
  // 敵のHPと残りターンは敵ごとの表示に含まれるので、まとめのバーは持たない
  renderEncounter();
  renderPlayerBadges(run);
  $('playerHPFill').style.width = Math.min(100, Math.max(0, run.playerHP / run.maxHP * 100)) + '%';
  $('playerHPText').textContent = Math.max(0, run.playerHP) + ' / ' + run.maxHP;
  $('playerHPRow').classList.toggle('low', run.playerHP / run.maxHP <= 0.25);
  if (flashEnemy) flash($('enemyStage'));
  if (flashPlayer) flash($('partyBox'));
  resizeBoard();
}

/**
 * 敵のHPバーの残量。塗りは単色の背景画像1枚で、その幅で残りを表す。
 * background-size は滑らかに補間できるので、削れる動きがそのまま付く
 * (グラデーションの色の境目を動かす書き方だと補間できず、カクつく)。
 */
function foeHealthSize(enemy) {
  const max = enemy.maxHP > 0 ? enemy.maxHP : 1;
  return `${Math.max(0, Math.min(100, enemy.hp / max * 100)).toFixed(1)}% 100%`;
}

function foeNumbersText(enemy) {
  const turns = enemy.cloneOf !== undefined || !Number.isFinite(enemy.turnsLeft)
    ? '' : ` ・ あと${enemy.turnsLeft}`;
  return `${enemy.hp} / ${enemy.maxHP}${turns}`;
}

/* 敵1体ぶんの要素。作り直すとHPバーの補間の起点が消えて動かなくなるので、
   顔ぶれが変わったときだけ作り、あとは中身を書き換えるだけにする。
   倒れた敵が畳まれていくのも、同じ要素が残っているから見せられる。 */
let foeCards = [];
let foeRosterKey = '';

/** 次の描画で敵の要素を作り直させる(出撃・フロア移動・再開のとき) */
function resetFoeCards() { foeCards = []; foeRosterKey = ''; }

function buildFoeCard(enemy, index) {
  const card = document.createElement('div');
  card.className = 'foe';
  // 絵と名前までがボタン。HPバーと数字はボタンの外に出す。
  // iOS はボタンの中に置いた帯の背景を塗らないことがあり、バーが消えていた。
  const target = document.createElement('button');
  target.className = 'foe-target';
  target.type = 'button';
  target.innerHTML = `<span class="foe-art">${artImg(enemy.spec.sprite, enemy.spec.emoji, 'enemy')}</span>`
    + `<span class="foe-name">${enemy.spec.name}</span>`;
  card.appendChild(target);
  const health = document.createElement('div');
  health.className = 'foe-health';
  card.appendChild(health);
  const numbers = document.createElement('div');
  numbers.className = 'foe-numbers';
  card.appendChild(numbers);
  const badges = document.createElement('div');
  badges.className = 'foe-badges';
  card.appendChild(badges);
  // 形ガードの形。絵の前に重ねるので .foe 直下(position:relative の子)に置く
  const shield = document.createElement('div');
  shield.className = 'foe-shield';
  shield.hidden = true;
  shield.setAttribute('aria-hidden', 'true');
  card.appendChild(shield);
  // 当たり判定はカード全体。中のボタンのクリックもここへ上がってくる
  card.addEventListener('click', () => {
    if (bstate === 'idle' || bstate === 'dragging') { run.targetIndex = index; updateHPUI(false, false); }
  });
  return { card, target, health, numbers, badges, shield };
}

function renderEncounter() {
  const root = $('enemyRoster');
  const ordered = run.enemies.length === 3 && run.enemies[0].summoned
    ? [run.enemies[1], run.enemies[0], run.enemies[2]] : run.enemies;
  // 顔ぶれか並びが変わったときだけ作り直す(フロア移動・分身の召喚)
  const key = ordered.map(e => `${run.enemies.indexOf(e)}:${e.spec.name}:${e.maxHP}`).join('|');
  if (key !== foeRosterKey) {
    foeRosterKey = key;
    foeCards = ordered.map((enemy, i) => buildFoeCard(enemy, run.enemies.indexOf(enemy)));
    root.replaceChildren(...foeCards.map(c => c.card));
  }
  ordered.forEach((enemy, i) => {
    const node = foeCards[i];
    if (!node) return;
    const index = run.enemies.indexOf(enemy);
    node.card.classList.toggle('target', index === run.targetIndex);
    node.card.classList.toggle('defeated', enemy.hp <= 0);
    if (enemy === run.actingEnemy) node.card.dataset.acting = 'true';
    else delete node.card.dataset.acting;
    node.target.disabled = enemy.hp <= 0;
    node.target.setAttribute('aria-label', `${enemy.spec.name}を狙う HP${enemy.hp}/${enemy.maxHP}`);
    node.health.style.backgroundSize = foeHealthSize(enemy);
    const text = foeNumbersText(enemy);
    if (node.numbers.textContent !== text) node.numbers.textContent = text;
    renderEnemyBadges(enemy.effects, node.badges);
    renderEnemyShield(enemy.effects, node.shield);
  });
}

function dealDamage(hits,chain=0,groups=[]) {
  const target=damageTarget(run);
  const result=damageEnemy({hp:target.hp,maxHP:target.maxHP,effects:target.effects,hits,chain,groups});
  target.hp=result.hp;
  return {...result,effects:target.effects};
}

async function checkBuildUps() {
  for(const enemy of run.enemies){
    if(enemy.hp<=0||enemy.builtUp)continue;
    const threshold=enemy.spec.enemySkills?.buildUpBelow;
    const clonesGone=enemy.summoned&&!run.enemies.some(e=>e.cloneOf===enemy.id&&e.hp>0);
    if((threshold!==undefined&&enemy.hp/enemy.maxHP*100<threshold)||clonesGone){
      enemy.builtUp=true;run.actingEnemy=enemy;
      await executeEnemyAction({effects:[{type:'buildUp'}],dialogue:clonesGone?'まやかしを破るとは……もう、手加減はしないわ。':undefined});
      run.actingEnemy=null;
    }
  }
}

function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
/* 敵を揺らすときは #enemyStage ではなく #enemyRoster を揺らすこと。
   ステージは画面いっぱいに背景(danjon_bg)を敷いているので、動かすと
   背景ごと横へずれて端に隙間ができる(「敵が左にずれる」と見える)。 */
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function showBanner(html) { $('banner').innerHTML = html; $('banner').classList.add('show'); }
function hideBanner() { $('banner').classList.remove('show'); }

/* ===================== スキル ===================== */
/** スキルの使用確認。内容を見せてから applySkill に進む */
let pendingSkill = null;
function confirmSkill(i) {
  if (!run || (bstate !== 'idle' && bstate !== 'dragging')) return;
  if (run.enemyEffects.binds[i]) { toast(`バインド中（残り${run.enemyEffects.binds[i]}ターン）`); return; }
  const m = run.party.members[i];
  const sk = m.skill;
  if (!sk) { toast(`${m.name}はスキルを持っていません`); return; }
  if (run.cooldowns[i] > 0) { toast(`${m.name}のスキルはあと${run.cooldowns[i]}ターン`); return; }

  pendingSkill = i;
  const aura = AURAS[m.aura];
  $('skillConfirmBody').innerHTML = `
    <div class="skill-confirm-head">
      <span class="skill-confirm-face" style="--aura:${COLOR_HEX[aura.key]}">
        ${charIcon(m.art && m.art.icon, m.portrait, 'sc')}
      </span>
      <span class="skill-confirm-who">
        <b>${m.name}</b>
        <span>${aura.emoji}${aura.name}オーラ ・ ${m.job}</span>
      </span>
    </div>
    <div class="skill-confirm-box">
      <div class="sname">${sk.name}</div>
      <div class="sdesc">${sk.desc}</div>
      <div class="sct">使用後は ${sk.cooldown} ターン使えません</div>
    </div>`;
  $('skillConfirmModal').classList.add('show');
}

function closeSkillConfirm() {
  pendingSkill = null;
  $('skillConfirmModal').classList.remove('show');
}

async function applySkill(i) {
  if (!run || (bstate !== 'idle' && bstate !== 'dragging')) return;
  const m = run.party.members[i];
  const sk = m.skill;
  if (!sk || run.cooldowns[i] > 0 || run.enemyEffects.binds[i]) return;

  const logs = [];
  const beforeBoard = (sk.convert || sk.spawn || sk.shuffle) ? board.map(row => row.slice()) : null;
  if (sk.timeThisTurn) {
    run.turnTimeBonusMs += sk.timeThisTurn * 1000;
    logs.push(`操作時間+${sk.timeThisTurn}秒`);
  }
  if (sk.healPct) {
    const amount = Math.round(run.maxHP * sk.healPct);
    run.playerHP = Math.min(run.maxHP, run.playerHP + amount);
    run.stats.totalHeal += amount;
    popUnit(i, '+' + amount, 'heal');
    logs.push(`HP+${amount}`);
  }
  if (sk.fixedDamage) {
    const dmg = Math.round(m.atk * sk.fixedDamage);
    /* 通常攻撃と同じ弾を敵へ飛ばしてから当てる。
       飛んでいるあいだは resolving にして、同じスキルを二度押せないようにする
       (641行目あたりの checkBuildUps と同じ手)。
       操作中なら dragStart をずらして、演出のぶん持ち時間が削られないようにする。 */
    const previous = bstate;
    bstate = 'resolving';
    const flightStart = performance.now();
    await playPartyAttacks([{ kind: 'dmg', index: i, aura: m.aura, value: dmg }]);
    dragStart += performance.now() - flightStart;
    bstate = previous;
    // 待っているあいだに離脱・全滅で run が消えていることがある
    if (!run) return;
    const result = dealDamage([{ aura: m.aura, value: dmg }]);
    playDamageMotion(result);
    run.stats.totalDamage += result.damage;
    popUnit(i, result.blocked ? '無効' : result.absorbed ? '吸収' : String(result.damage), 'dmg');
    shake($('enemyRoster'));
    logs.push(result.blocked ? 'ダメージ無効' : result.absorbed ? `${result.absorbed}吸収` : `${result.damage}ダメージ${result.survived ? '・根性' : ''}`);
  }
  if (sk.convert) {
    // 単体でも配列でも受け付ける(進化後スキルは複数オーラを変換する)
    const pairs = Array.isArray(sk.convert) ? sk.convert : [sk.convert];
    const parts = [];
    pairs.forEach(cv => {
      const from = COLORS.indexOf(cv.from), to = COLORS.indexOf(cv.to);
      const n = convertColor(board, from, to).length;
      parts.push(`${AURAS[from].name}→${AURAS[to].name} ${n}個`);
    });
    logs.push(parts.join(' / '));
  }
  if (sk.spawn) {
    const to = COLORS.indexOf(sk.spawn.to);
    const n = spawnColor(board, to, sk.spawn.count).length;
    logs.push(`${AURAS[to].name}オーラ${n}個生成`);
  }
  if (sk.shuffle) { shuffleBoard(board); logs.push('盤面シャッフル'); }
  if (beforeBoard) animateConversion(beforeBoard, board);
  if (sk.atkBuff) { run.buffs.atk = { ...sk.atkBuff }; logs.push(`攻撃力${sk.atkBuff.mult}倍(${sk.atkBuff.turns}ターン)`); }
  if (sk.guard) {
    run.buffs.guard = { ...sk.guard };
    logs.push(sk.guard.rate >= 1 ? `${sk.guard.turns}ターン無敵` : `被ダメ${Math.round(sk.guard.rate * 100)}%減(${sk.guard.turns}ターン)`);
  }
  if (sk.delay) { run.enemies.filter(e=>e.hp>0&&e.cloneOf===undefined).forEach(e=>e.turnsLeft+=sk.delay); logs.push(`敵の攻撃を${sk.delay}ターン遅延`); }

  run.cooldowns[i] = sk.cooldown;
  run.stats.skillUses++;
  updateSkillUI();
  updateHPUI(false, false);
  showBanner(`<span class="bskill">${m.name}「${sk.name}」</span> ${logs.join(' / ')}`);
  setTimeout(() => { if (bstate !== 'resolving') hideBanner(); }, 1600);

  if (encounterCleared(run) && bstate !== 'resolving') { bstate = 'resolving'; floorClear(); }
  else if (sk.fixedDamage) { const previous=bstate;bstate='resolving';await checkBuildUps();retarget(run);updateHPUI(false,false);bstate=previous; }
  // 盤面もクールダウンも変わったので、ここで中断データを取り直す
  if (run) persistRun();
}

function openPartyInfo() {
  if (!run) return;
  const box = $('partyInfoList');
  box.innerHTML = '';
  run.party.members.forEach((m, i) => {
    const aura = AURAS[m.aura];
    const ls = m.leaderSkill, sk = m.skill;
    const isLeaderActive = run.party.leaders.includes(m);
    const div = document.createElement('div');
    div.className = 'pinfo r' + m.rarity;
    div.style.setProperty('--aura', COLOR_HEX[aura.key]);
    div.innerHTML = `
      <div class="pinfo-head">
        <span class="pinfo-portrait">${charIcon(m.art && m.art.icon, m.portrait, 'pinfo')}</span>
        <span class="pinfo-id">
          <b>${m.name}</b>
          <span class="pinfo-sub">${aura.emoji}${aura.name} ・ ${m.job} ・ ${RARITY_TITLE[m.rarity]}${
            m.isSupport ? ` ・ ${m.ownerIcon || '🤝'}${m.ownerName || 'サポート'}` : ''}</span>
        </span>
        <span class="pinfo-stat">ATK ${m.atk}<br>HP ${m.hp}<br>RCV ${m.rcv}</span>
      </div>
      <div class="skill-line${isLeaderActive ? ' on' : ' off'}">
        <span class="skill-tag ls">LS</span>
        <span><b>${ls ? ls.name : '—'}</b><br>${ls ? ls.desc : ''}
        ${isLeaderActive ? '' : '<i class="off-note">※リーダー/サポートではないため未発動</i>'}</span>
      </div>
      <div class="skill-line on">
        <span class="skill-tag sk">SKILL</span>
        <span><b>${sk ? sk.name : '—'}</b>(CT ${sk ? sk.cooldown : '-'})<br>${sk ? sk.desc : ''}
        <i class="off-note">残り ${run.cooldowns[i]} ターン${run.enemyEffects.binds[i] ? ` / バインド：残り${run.enemyEffects.binds[i]}ターン（攻撃・回復・スキル使用不可）` : ''}</i></span>
      </div>`;
    box.appendChild(div);
  });
  $('partyInfoModal').classList.add('show');
}

/* ===================== ターン解決 ===================== */
async function resolveTurn() {
  bstate = 'resolving';
  run.stats.turns++;

  chainLabels = [];
  let chain = 0, turnDamage = 0, turnHeal = 0, anyAction = false;
  const hits = [], clearedGroups = [];
  const pending = new Map();
  while (true) {
    const groups = findGroups(board, run.matchMin).filter(g => !run.enemyEffects.auraBinds[g.color]);
    if (groups.length === 0) break;
    chain++;

    const actions = baseActions(groups, run);
    clearedGroups.push(...groups);
    const stepDamage = actions.filter(a => a.kind === 'dmg').reduce((s, a) => s + a.value, 0);
    const stepHeal = actions.filter(a => a.kind === 'heal').reduce((s, a) => s + a.value, 0);
    turnDamage += stepDamage;
    turnHeal += stepHeal;
    if (actions.length) anyAction = true;

    let html = chainBanner(chain);
    if (stepDamage > 0) html += ` <span class="dmg">基礎ダメージ +${Math.round(stepDamage)}</span>`;
    if (stepHeal > 0) html += ` <span class="heal">基礎回復 +${Math.round(stepHeal)}</span>`;
    if (groups.length > 1) html += ` <span class="simul">同時${groups.length}消し</span>`;
    if (!actions.length) html += ' <span class="miss">攻撃できるキャラなし</span>';
    showBanner(html);

    clearingCells = groups.flatMap(g => g.cells);
    clearStart = performance.now();
    // 消えた位置の中心に連鎖数を出す。前の表示も少し残るので進み方が追える
    const cr = clearingCells.reduce((s, [r]) => s + r, 0) / clearingCells.length;
    const cc = clearingCells.reduce((s, [, c]) => s + c, 0) / clearingCells.length;
    chainLabels.push({ r: cr, c: cc, n: chain, born: clearStart });
    actions.forEach(a => {
      const total = pending.get(a.index) || { ...a, aura: run.party.members[a.index].aura, value: 0 };
      total.value += a.value;
      pending.set(a.index, total);
    });
    finalActions(pending.values(), chain, run.mods).forEach(total => {
      const label = $('partyRow').children[total.index].querySelector('.unit-pending');
      label.hidden = false;
      label.classList.toggle('heal', total.kind === 'heal');
      label.textContent = (total.kind === 'heal' ? '+' : '') + total.value.toLocaleString();
    });
    await sleep(270);

    groups.forEach(g => g.cells.forEach(([r, c]) => { board[r][c] = -1; }));
    clearingCells = [];

    await sleep(110);
    applyGravityNoRefill(board);
    await sleep(190);
  }

  // 連鎖が全て終わってから、合計ぶんをまとめて反映する
  if (chain > 0 && isAllClear(board)) {
    run.chancePending = true;
    showBanner('<span class="chain">全消しボーナス！</span> 次はチャンス盤面！');
    await sleep(800);
  }
  const charged = finalActions(pending.values(), chain, run.mods);
  hits.push(...charged.filter(a => a.kind === 'dmg'));
  turnHeal = charged.filter(a => a.kind === 'heal').reduce((sum,a) => sum+a.value,0);
  run.targetIndex=run.enemies.indexOf(damageTarget(run));
  updateHPUI(false,false);
  await playPartyAttacks(charged);
  const outcome = dealDamage(hits,chain,clearedGroups);
  turnDamage = outcome.damage;
  if (turnHeal > 0) run.playerHP = Math.min(run.maxHP, run.playerHP + turnHeal);
  $('partyRow').querySelectorAll('.unit-pending').forEach(label => { label.hidden = true; label.textContent = ''; });
  updateHPUI(turnDamage > 0, turnHeal > 0);
  await playDamageMotion(outcome);
  if (turnDamage > 0) {
    shake($('enemyRoster'));
  }
  if (turnDamage > 0 || turnHeal > 0 || outcome.blocked || outcome.absorbed) {
    let html = chainBanner(chain);
    if (turnDamage > 0) html += ` <span class="dmg">${turnDamage} ダメージ</span>`;
    if (turnHeal > 0) html += ` <span class="heal">+${turnHeal} 回復</span>`;
    if (outcome.blocked) html += ' ダメージ無効';
    if (outcome.absorbed) html += ` 敵が${outcome.absorbed}吸収`;
    if (outcome.survived) html += ' 根性発動！';
    showBanner(html);
    updateHPUI(turnDamage > 0, turnHeal > 0);
    await sleep(520);
  }

  run.stats.maxChain = Math.max(run.stats.maxChain, chain);
  run.stats.totalDamage += turnDamage;
  run.stats.totalHeal += turnHeal;
  await sleep(220);

  run.chanceActive = false;
  run.chanceHint = null;
  updateChanceUI();
  // 継続毒はプレイヤーの手番終了時に発生する。敵を倒した手番でも、
  // すでに受けている毒からは逃れられない。
  const poisonDmg = poisonDamage(run.enemyEffects, run.maxHP);
  if (poisonDmg > 0) {
    run.playerHP = Math.max(0, run.playerHP - poisonDmg);
    showBanner(`<span class="dmg">毒 ${poisonDmg} ダメージ</span>`);
    updateHPUI(false, true);
    shake($('partyBox'));
    await sleep(420);
  }
  tickEncounter(run);

  if (run.playerHP <= 0) { battleDefeat(); return; }

  if (encounterCleared(run)) { hideBanner(); await floorClear(); return; }
  await checkBuildUps();retarget(run);

  // 盤面が枯れて詰まないよう空きマスを補充する
  if (run.chancePending) { activateChanceBoard(); await sleep(180); }
  else {
    run.chanceActive = false;
    updateChanceUI();
    if (refillBoard(board, run.matchMin) > 0) await sleep(180);
  }

  if (chain === 0) {
    showBanner('<span class="miss">オーラが消えなかった…</span>');
    await sleep(650);
  } else if (!anyAction) {
    showBanner('<span class="miss">オーラが合わず誰も攻撃できない!</span>');
    await sleep(650);
  }

  // 自分の手番による短縮を先に行い、この後に受ける遅延を相殺しない。
  run.cooldowns = run.cooldowns.map(cd => Math.max(0, cd - 1));
  run.skillDelayDebt = run.skillDelayDebt?.map(n => Math.max(0,n-1));
  // 敵の攻撃カウント
  for (const enemy of run.enemies.filter(e=>e.hp>0&&e.cloneOf===undefined)) {
    run.actingEnemy=enemy;
    enemy.turnsLeft--;
    if (enemy.turnsLeft <= 0) {
      const skills=enemy.spec.enemySkills;
      const index=skills?.random?randInt(0,skills.actions.length-1):enemy.actionIndex++;
      await executeEnemyAction(enemyAction(skills,index));
      enemy.turnsLeft=enemy.interval;
    }
    if(run.playerHP<=0)break;
  }
  run.actingEnemy=null;
  hideBanner();

  tickTurnEnd();
  updateHPUI(false, false);
  resetTimerUI();

  if (run.playerHP <= 0) { battleDefeat(); return; }
  goIdle();
}

/** ターン終了時のクールダウン/バフ更新 */
function tickTurnEnd() {
  ['atk', 'guard'].forEach(k => {
    const b = run.buffs[k];
    if (!b) return;
    b.turns--;
    if (b.turns <= 0) run.buffs[k] = null;
  });
  run.turnTimeBonusMs = 0;
  updateSkillUI();
}

function updateChanceUI() {
  $('boardWrap').classList.toggle('chance-board', !!run.chanceActive);
  $('chanceNotice').hidden = !run.chanceActive;
}

function activateChanceBoard() {
  const chance = createChanceBoard(run.stage.auras, run.matchMin);
  board = chance.board;
  run.chancePending = false;
  run.chanceActive = true;
  // 入れ替える2マスの光。盤面を隙間なく埋めたぶん梯子が絵に紛れるので、
  // 仕込みの場所だけ示す。掴んだ時点で消す(onPointerDown)
  run.chanceHint = chance.swap;
  updateChanceUI();
}

/**
 * 敵の行動を実行する。
 * 先制行動は文字も演出も出さず、効果だけを静かにかける。ノーマル以外の
 * ダンジョンではほぼ毎フロア先制で妨害してくるので、先制では
 * 「敵の行動！」の帯は出さない(テンポが悪くなる)。
 * 演出そのものは出す。何をされたのか分からないまま操作時間だけ
 * 削られるのが一番つらいため。かかった状態はバッジでも分かる。
 */
async function executeEnemyAction(action, preemptive = false) {
  if(action.dialogue){const spec=combatEnemy(run).spec;await bossDialogue(spec.name,action.dialogue,spec.sprite);}
  const labels = [];
  const motions = [];
  for (const effect of action.effects || []) {
    if(effect.type==='summonClones'){summonClones(run,combatEnemy(run));labels.push('分身体が出現');continue;}
    const targets = applyEnemyEffect(run.enemyEffects, effect, run.cooldowns);
    if(effect.type==='skillDelay'){
      run.skillDelayDebt ||= run.party.members.map(()=>0);
      targets.forEach(i=>{run.skillDelayDebt[i]+=effect.turns;});
    }
    motions.push({ ...effect, targets });
    labels.push(({ recoveryReduce: '回復力減少', poison: '毒', bind: 'バインド', skillDelay: 'スキルターン遅延', comboGuard: 'コンボガード', shapeGuard: '形状指定', auraBind: 'オーラバインド', timeReduce: '操作時間短縮', timeFixed: '操作時間固定', auraAbsorb: 'オーラ吸収', buildUp: 'ビルドアップ', resolve: '根性' })[effect.type]);
  }
  if (action.attack) {
    let dmg = Math.max(1, Math.round((run.enemyAtk + randInt(-2, 4)) * run.enemyEffects.attackMult));
    const cut = 1 - (1 - run.mods.damageCut) * (1 - (run.buffs.guard?.rate || 0));
    dmg = Math.max(cut >= 1 ? 0 : 1, Math.round(dmg * (1 - cut)));
    run.playerHP = Math.max(0, run.playerHP - dmg);
    labels.push(`${dmg}ダメージ`);
    shake($('partyBox'));
  }
  updateSkillUI();
  if (preemptive) {
    updateHPUI(false, false);
    // 先制は毎フロア来るので、帯(750ms)は出さない。
    // ただし演出そのものは出す。何をされたのか分からないまま
    // 操作時間だけ削られる状態が一番つらいため。
    await playEnemyMotion(motions, board);
    return;
  }
  showBanner(`敵の行動！ ${labels.join(' / ')}`);
  updateHPUI(false, !!action.attack);
  await Promise.all([playEnemyMotion(motions, board), sleep(750)]);
  hideBanner();
}

function playDamageMotion(result) {
  const effects = (result.effects || run.enemyEffects).defenses;
  const motions = [];
  if (result.blocked) motions.push(...effects.filter(e => e.type === 'comboGuard' || e.type === 'shapeGuard'));
  if (result.absorbed) motions.push(...effects.filter(e => e.type === 'auraAbsorb'));
  if (result.survived) motions.push({ type: 'resolve', triggered: true });
  return playEnemyMotion(motions, board);
}

/* ===================== フロア進行 ===================== */
async function floorClear() {
  bstate = 'resolving';
  const isLast = run.floorIndex >= run.stage.floors.length - 1;
  if (isLast) { finishRun(); return; }
  showBanner('<span class="chain">フロアクリア!</span> 次のフロアへ…');
  await sleep(1000);
  run.floorIndex++;
  // クールダウンはフロアをまたいでも引き継ぐ(1フロアぶん進める)
  run.cooldowns = run.cooldowns.map(cd => Math.max(0, cd - 1));
  run.skillDelayDebt = run.skillDelayDebt?.map(n => Math.max(0,n-1));
  await loadFloor();
  if (!run) return;
  bstate = 'resolving';
  renderFloorPips();
  updateSkillUI();
  showBanner(`<span class="chain">フロア ${run.floorIndex + 1}</span>`);
  await sleep(700);
  hideBanner();
  goIdle();
}

/* ===================== ドロップ ===================== */
/**
 * ステージクリア時の素材ドロップを抽選する。
 * ステージ固有のオーラ結晶を多めに、たまに他オーラと進化の輝石が出る。
 * @returns {object} {materialId: 個数}
 */
function rollDrops(stage, hard) {
  const drops = {};
  const add = (id, n) => { if (n > 0) drops[id] = (drops[id] || 0) + n; };
  const mult = hard ? 2 : 1;
  const dm = stage.dropMult || 1;              // 曜日ダンジョンの難易度倍率
  const shardChance = Math.min(1, stage.shardRate * (hard ? 1.6 : 1));

  // ゴールド特化はコイン報酬だけを厚くするので、素材は落とさない
  if (stage.dropType === 'gold') return drops;

  if (stage.dropType === 'exp') {
    add('mt_exp1', Math.round((2 + randInt(0, 2)) * dm) * mult);
    if (Math.random() < Math.min(0.9, 0.3 * dm)) add('mt_exp2', randInt(1, 2) * mult);
    return drops;
  }

  if (stage.dropType === 'crystal') {
    // 曜日の素材ダンジョン。狙った色だけをまとめて落とす
    add(crystalIdFor(stage.dropAura), Math.round((4 + randInt(0, 3)) * dm) * mult);
    if (Math.random() < shardChance) add('mt_star', randInt(1, 3) * mult);
    return drops;
  }

  add(crystalIdFor(stage.dropAura), ((stage.crystalBase || 2) + randInt(0, 2)) * mult);
  // 他オーラの結晶もたまに落ちる(どのキャラも育てられるように)
  if (Math.random() < 0.55) {
    // 他オーラはそのステージに出る色から選ぶ(闇の結晶は闇が出る階層だけ)
    const pool = stage.auras || [0, 1, 2, 3];
    const other = pool[randInt(0, pool.length - 1)];
    add(crystalIdFor(other), randInt(1, Math.max(2, Math.round((stage.crystalBase || 2) * 0.6))) * mult);
  }
  if (Math.random() < shardChance) add('mt_star', randInt(1, 2) * mult);
  return drops;
}

/* ===================== リザルト ===================== */
function finishRun() {
  bstate = 'over';
  clearRunSnapshot();
  const { stage, hard, stats } = run;
  const prog = state.progress[stage.id] = state.progress[stage.id] || {};
  // 初クリア報酬は難易度ごとに1回だけ。記録を付ける前に判定する
  const firstClear = !(hard ? prog.hard : prog.normal);
  if (hard) prog.hard = true; else prog.normal = true;

  const coin = Math.round(stage.coinReward * (hard ? HARD_REWARD_MULT : 1));
  // 初クリアぶんは周回報酬と違って倍率をかけない(ノーマルもハードも同じ数)
  const firstOrb = firstClear ? (stage.firstClearOrb || 0) : 0;
  const orb  = (hard ? Math.round(stage.orbReward * HARD_REWARD_MULT) : stage.orbReward) + firstOrb;
  const exp  = Math.round(stage.expReward * (hard ? HARD_REWARD_MULT : 1));
  state.coin += coin; state.orb += orb;

  const key = stage.id + '_' + (hard ? 'hard' : 'normal');
  const rec = state.records[key] || { maxChain: 0 };
  const isNewRecord = stats.maxChain > rec.maxChain;
  if (isNewRecord) rec.maxChain = stats.maxChain;
  state.records[key] = rec;
  saveState();

  // 素材ドロップと編成キャラの育成(サポートは自分のキャラではないので対象外)
  const currencyDrop = stage.currencyDrop && materialById(stage.currencyDrop.id)
    ? rollCurrencyDrop(stage, run.party) : null;
  const drops = currencyDrop ? { [currencyDrop.id]: currencyDrop.total } : rollDrops(stage, hard);
  addMaterials(drops);
  const dropRate = stage.raid ? raidDropRate(stage,run.party.own) : 0;
  const characterDropped=rollRaidCharacter(stage,run.party.own);
  if(characterDropped)addCharacter(characterDropped);
  const charExp = Math.round((stage.charExpReward || 40) * (hard ? HARD_REWARD_MULT : 1));
  const levelUps = gainCharExp(run.party.own.map(m => m.id), charExp);

  const { ups, staminaGained } = gainExp(exp);

  $('resultTitle').textContent = 'STAGE CLEAR';
  $('resultCard').classList.remove('defeat');
  $('resultStats').innerHTML = `
    <div class="rstat"><span>最高コンボ</span><b>${stats.maxChain}${isNewRecord ? ' <span class="rnew">NEW!</span>' : ''}</b></div>
    <div class="rstat"><span>与ダメージ合計</span><b>${stats.totalDamage}</b></div>
    <div class="rstat"><span>回復量合計</span><b>${stats.totalHeal}</b></div>
    <div class="rstat"><span>ターン数 / スキル使用</span><b>${stats.turns} / ${stats.skillUses}</b></div>
    <div class="rstat"><span>残りHP</span><b>${run.playerHP} / ${run.maxHP}</b></div>`;
  const dropHTML = Object.keys(drops).map(id => {
    const mt = materialById(id);
    const bonus = id === currencyDrop?.id ? currencyDrop.bonus : 0;
    return `<div class="rrow drop" style="--mt:${mt.color}">${itemIcon(mt.id)} ${mt.name} <b>×${drops[id]}${bonus ? `（特効 +${bonus}）` : ''}</b></div>`;
  }).join('');
  $('resultRewards').innerHTML = `
    <div class="rrow">${itemIcon('coin')} <b>${coin}</b></div>
    ${orb - firstOrb ? `<div class="rrow">${itemIcon('orb')} <b>${orb - firstOrb}</b></div>` : ''}
    ${firstOrb ? `<div class="rrow first-clear">🏅 初クリア報酬 ${itemIcon('orb')} <b>${firstOrb}</b></div>` : ''}
    <div class="rrow">⭐ <b>EXP ${exp}</b></div>
    <div class="rrow">🧬 <b>キャラEXP ${charExp}</b></div>
    ${dropHTML}${stage.raid && stage.characterDrop?.id ? `<div class="rrow">${raidDropResultHTML(stage, characterDropped, dropRate)}</div>` : ''}`;

  // フレンド以外から借りていたら、ここで登録できるようにする
  const sup = run.party.support;
  const box = $('resultFriendBox');
  const canInvite = !!(sup && sup.ownerUid && !state.profile.friends.some(f => f.uid === sup.ownerUid));
  box.hidden = !canInvite;
  if (canInvite) {
    pendingFriendUid = sup.ownerUid;
    pendingFriendName = sup.ownerName || 'プレイヤー';
    $('resultFriendText').innerHTML =
      `${sup.ownerIcon || '🙂'} <b>${pendingFriendName}</b> のサポートで攻略しました。フレンドになりますか?`;
    $('resultAddFriendBtn').disabled = false;
    $('resultAddFriendBtn').textContent = 'フレンド登録する';
  }
  $('resultRank').innerHTML =
    (ups > 0
      ? `<div class="rankup">🎉 ランクアップ! ランク:${state.rank}
          <span>スタミナ +${staminaGained}(現在 ${state.stamina} / 上限 ${maxStamina()})</span></div>`
      : '')
    + (levelUps.length
      ? `<div class="levelup">⬆️ レベルアップ!
          <span>${levelUps.map(l => `${l.name} Lv${l.from}→<b>${l.to}</b>`).join(' / ')}</span></div>`
      : '');
  $('resultModal').classList.add('show');
  updateStatusBar();
  run = null;
}

function battleDefeat() {
  bstate = 'over';
  clearRunSnapshot();
  $('resultTitle').textContent = 'DEFEAT';
  $('resultCard').classList.add('defeat');
  $('resultStats').innerHTML = `
    <div class="rstat"><span>到達フロア</span><b>${run.floorIndex + 1} / ${run.stage.floors.length}</b></div>
    <div class="rstat"><span>最高コンボ</span><b>${run.stats.maxChain}</b></div>
    <div class="rstat"><span>与ダメージ合計</span><b>${run.stats.totalDamage}</b></div>`;
  $('resultRewards').innerHTML = '<div class="rrow rnone">HPが尽きた…報酬なし</div>';
  $('resultRank').innerHTML = '';
  $('resultFriendBox').hidden = true;
  pendingFriendUid = null;
  $('resultModal').classList.add('show');
  run = null;
}

function retreat() {
  if (bstate === 'resolving') return;
  bstate = 'over';
  clearRunSnapshot();
  run = null;
  showScreen(returnScreen, { preserve: true });
}

/* ===================== 入力 ===================== */
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function onPointerDown(e) {
  if (!run) return;
  // 手番未開始なら新規開始。開始済みで時間内かつ今どのオーブも掴んでいなければ掴み直せる。
  if (bstate === 'idle') {
    bstate = 'dragging';
    dragStart = performance.now();
    autoReleased = false;
    // 操作に入ったら光は消す。役目は「見つける」ところまでで、
    // 点けたままだと動かしているオーラの色が読みにくくなる
    run.chanceHint = null;
  } else if (!(bstate === 'dragging' && !autoReleased && !grabbed)) {
    return;
  }
  const { x, y } = getPos(e);
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (board[r][c] === -1) return;
  grabbed = true;
  selected = { r, c };
  floatPos = { x, y };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
}
function onPointerMove(e) {
  if (bstate !== 'dragging' || !grabbed || !selected) return;
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
  if (bstate !== 'dragging' || autoReleased || !grabbed) return;
  // 指を離しても操作時間内なら手番は終わらせず、掴みを解除するだけにする
  grabbed = false;
  selected = null;
  floatPos = null;
}
