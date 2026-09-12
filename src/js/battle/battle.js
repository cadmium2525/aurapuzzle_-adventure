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
import { $, sleep, randInt, toast, artImg } from '../core/ui.js';
import {
  state, saveState, gainExp, maxStamina, gainCharExp, addMaterials
} from '../core/state.js';
import { showScreen, currentScreen, updateStatusBar } from '../core/nav.js';
import { setRetreatHandler } from '../core/sysmodal.js';
import {
  AURAS, COLORS, COLOR_HEX, HEAL_COLOR, RARITY_TITLE,
  FLOORS_PER_STAGE, HARD_HP_MULT, HARD_REWARD_MULT,
  ATTACK_SCALE, HEAL_SCALE, ORB_BONUS, COMBO_BONUS, SIMUL_BONUS,
  MAX_DRAG_TIME, MATERIALS, materialById, crystalIdFor
} from '../data/gamedata.js';
import {
  COLS, ROWS, genBoard, findGroups, applyGravityNoRefill, refillBoard,
  convertColor, spawnColor, shuffleBoard
} from './board.js';
import { buildParty, comboMultiplier, auraMultiplier } from './party.js';
import { initRenderer, resizeBoard, drawBoard, CELL } from './renderer.js';

let canvas;
let board = [];
let bstate = 'idle';       // idle | dragging | resolving | over
let selected = null, floatPos = null, dragStart = 0, autoReleased = false;
let grabbed = false;       // 操作時間内で「今まさに指がオーブを掴んでいるか」
let clearingCells = [], clearStart = 0;
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
  $('battleInfoBtn').addEventListener('click', openPartyInfo);
  $('partyInfoCloseBtn').addEventListener('click', () => $('partyInfoModal').classList.remove('show'));
  $('partyInfoModal').addEventListener('click', e => {
    if (e.target === $('partyInfoModal')) $('partyInfoModal').classList.remove('show');
  });
  requestAnimationFrame(loop);
}

/** そのターンに使える操作時間(ms) */
function dragTimeMs() {
  return Math.min(MAX_DRAG_TIME, run.party.baseDragTime + run.turnTimeBonusMs);
}

/* ===================== 描画ループ ===================== */
function loop(t) {
  if (currentScreen === 'battle' && run) {
    const clearT = clearingCells.length ? (t - clearStart) / 260 : 0;
    drawBoard({ board, t, selected, floatPos, dragging: bstate === 'dragging', clearingCells, clearT });
    if (bstate === 'dragging' && !autoReleased) {
      const total = dragTimeMs();
      const remain = Math.max(0, total - (t - dragStart));
      const ratio = remain / total;
      $('timerFill').style.width = (ratio * 100) + '%';
      $('timerNum').textContent = (remain / 1000).toFixed(1) + 's';
      $('timerRow').classList.toggle('danger', remain <= 3000);
      // 時間内なら指を離しても手番は終わらず、別のオーブを掴み直して操作を続けられる
      if (remain <= 0) {
        autoReleased = true; grabbed = false; selected = null; floatPos = null;
        $('timerRow').classList.remove('danger');
        resolveTurn();
      }
    }
  }
  requestAnimationFrame(loop);
}

/* ===================== ラン開始 ===================== */
/**
 * @param {object} stage ステージ定義
 * @param {boolean} hard ハードモードか
 * @param {object|null} support サポート枠のキャラクター
 */
export function startDungeonRun(stage, hard, support) {
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
    turnTimeBonusMs: 0,
    stats: { maxChain: 0, totalDamage: 0, totalHeal: 0, turns: 0, skillUses: 0 }
  };
  renderParty();
  renderLeaderChips();
  loadFloor();
  showScreen('battle');
  resizeBoard();
}

/* ===================== パーティ表示 ===================== */
function unitRoleBadge(i) {
  const sup = run.party.support;
  if (sup && i === run.party.members.length - 1) {
    return `<span class="unit-badge support">${sup.ownerIcon || '🤝'}</span>`;
  }
  if (i === 0) return '<span class="unit-badge leader">L</span>';
  return '';
}

function renderParty() {
  const row = $('partyRow');
  row.innerHTML = '';
  run.party.members.forEach((m, i) => {
    const aura = AURAS[m.aura];
    const sk = m.skill;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unit r' + m.rarity + (m.isSupport ? ' support' : '');
    btn.dataset.idx = String(i);
    btn.title = m.isSupport ? `${m.name}(${m.ownerName || 'サポート'}から)` : m.name;
    btn.style.setProperty('--aura', COLOR_HEX[aura.key]);
    btn.innerHTML = `
      <span class="unit-pops"></span>
      <span class="unit-face">
        <span class="unit-portrait">${artImg(m.art && m.art.icon, m.portrait, 'unit')}</span>
        <span class="unit-aura">${aura.emoji}</span>
        ${unitRoleBadge(i)}
      </span>
      <span class="unit-name">${m.name}</span>
      <span class="unit-skill"><span class="unit-skill-fill"></span><span class="unit-skill-text">${sk ? sk.name : '—'}</span></span>`;
    btn.addEventListener('click', () => useSkill(i));
    row.appendChild(btn);
  });
  updateSkillUI();
}

/** リーダースキル(自陣リーダー + サポート)のチップ表示 */
function renderLeaderChips() {
  const box = $('leaderChips');
  box.innerHTML = '';
  run.party.leaders.forEach((m, i) => {
    const ls = m.leaderSkill;
    if (!ls) return;
    const chip = document.createElement('div');
    chip.className = 'ls-chip';
    chip.innerHTML = `<span class="ls-who">${i === 0 ? 'LEADER' : 'SUPPORT'}</span>
      <span class="ls-name">${ls.name}</span>`;
    box.appendChild(chip);
  });
}

function updateSkillUI() {
  const units = $('partyRow').children;
  run.party.members.forEach((m, i) => {
    const unit = units[i];
    if (!unit) return;
    const sk = m.skill;
    const cd = run.cooldowns[i];
    const ready = sk && cd <= 0;
    unit.classList.toggle('ready', !!ready);
    const fill = unit.querySelector('.unit-skill-fill');
    const text = unit.querySelector('.unit-skill-text');
    if (!sk) { fill.style.width = '0%'; text.textContent = '—'; return; }
    fill.style.width = ready ? '100%' : Math.round((1 - cd / sk.cooldown) * 100) + '%';
    text.textContent = ready ? sk.name : `${cd}ターン`;
  });
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
function loadFloor() {
  const floor = run.stage.floors[run.floorIndex];
  run.enemyMaxHP = Math.round(floor.hp * (run.hard ? HARD_HP_MULT : 1));
  run.enemyHP = run.enemyMaxHP;
  run.enemyAtk = Math.round(floor.atk * (run.hard ? HARD_HP_MULT : 1));
  run.enemyInterval = floor.interval;
  run.enemyTurnsLeft = floor.interval;

  $('enemyEmoji').textContent = floor.emoji;
  $('enemyName').textContent = floor.name;
  $('battleStageName').textContent = run.stage.name + (run.hard ? ' / ハード' : '');
  renderFloorPips();
  board = genBoard(run.matchMin);
  bstate = 'idle';
  grabbed = false;
  clearingCells = [];
  run.turnTimeBonusMs = 0;
  hideBanner();
  resetTimerUI();
  updateHPUI(false, false);
}

function renderFloorPips() {
  const box = $('floorPips');
  box.innerHTML = '';
  for (let i = 0; i < FLOORS_PER_STAGE; i++) {
    const pip = document.createElement('span');
    pip.className = 'fpip'
      + (i < run.floorIndex ? ' done' : '')
      + (i === run.floorIndex ? ' now' : '')
      + (i === FLOORS_PER_STAGE - 1 ? ' boss' : '');
    box.appendChild(pip);
  }
}

function resetTimerUI() {
  const total = dragTimeMs();
  $('timerFill').style.width = '100%';
  $('timerNum').textContent = (total / 1000).toFixed(1) + 's';
  $('timerRow').classList.remove('danger');
}

/* ===================== HP表示 ===================== */
function updateHPUI(flashEnemy, flashPlayer) {
  $('enemyHPFill').style.width = Math.max(0, run.enemyHP / run.enemyMaxHP * 100) + '%';
  $('enemyHPText').textContent = Math.max(0, run.enemyHP) + ' / ' + run.enemyMaxHP;
  $('playerHPFill').style.width = Math.min(100, Math.max(0, run.playerHP / run.maxHP * 100)) + '%';
  $('playerHPText').textContent = Math.max(0, run.playerHP) + ' / ' + run.maxHP;
  $('playerHPRow').classList.toggle('low', run.playerHP / run.maxHP <= 0.25);
  renderEnemyTurnPips();
  if (flashEnemy) flash($('enemyStage'));
  if (flashPlayer) flash($('partyBox'));
}

function renderEnemyTurnPips() {
  const box = $('enemyTurnPips');
  box.innerHTML = '';
  for (let i = 0; i < run.enemyInterval; i++) {
    const pip = document.createElement('span');
    pip.className = 'tpip' + (i < run.enemyTurnsLeft ? '' : ' spent');
    box.appendChild(pip);
  }
  $('enemyTurnCount').textContent = run.enemyTurnsLeft;
}

function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function showBanner(html) { $('banner').innerHTML = html; $('banner').classList.add('show'); }
function hideBanner() { $('banner').classList.remove('show'); }

/* ===================== スキル ===================== */
function useSkill(i) {
  if (!run || (bstate !== 'idle' && bstate !== 'dragging')) return;
  const m = run.party.members[i];
  const sk = m.skill;
  if (!sk) return;
  if (run.cooldowns[i] > 0) { toast(`${m.name}のスキルはあと${run.cooldowns[i]}ターン`); return; }

  const logs = [];
  if (sk.timeThisTurn) {
    run.turnTimeBonusMs += sk.timeThisTurn * 1000;
    logs.push(`操作時間+${sk.timeThisTurn}秒`);
    if (bstate === 'dragging') {
      const total = dragTimeMs();
      $('timerNum').textContent = (Math.max(0, total - (performance.now() - dragStart)) / 1000).toFixed(1) + 's';
    } else {
      resetTimerUI();
    }
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
    run.enemyHP = Math.max(0, run.enemyHP - dmg);
    run.stats.totalDamage += dmg;
    popUnit(i, String(dmg), 'dmg');
    shake($('enemyStage'));
    logs.push(`${dmg}ダメージ`);
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
  if (sk.atkBuff) { run.buffs.atk = { ...sk.atkBuff }; logs.push(`攻撃力${sk.atkBuff.mult}倍(${sk.atkBuff.turns}ターン)`); }
  if (sk.guard) {
    run.buffs.guard = { ...sk.guard };
    logs.push(sk.guard.rate >= 1 ? `${sk.guard.turns}ターン無敵` : `被ダメ${Math.round(sk.guard.rate * 100)}%減(${sk.guard.turns}ターン)`);
  }
  if (sk.delay) { run.enemyTurnsLeft += sk.delay; logs.push(`敵の攻撃を${sk.delay}ターン遅延`); }

  run.cooldowns[i] = sk.cooldown;
  run.stats.skillUses++;
  updateSkillUI();
  updateHPUI(false, false);
  showBanner(`<span class="bskill">${m.name}「${sk.name}」</span> ${logs.join(' / ')}`);
  setTimeout(() => { if (bstate !== 'resolving') hideBanner(); }, 1600);

  if (run.enemyHP <= 0 && bstate !== 'resolving') { bstate = 'resolving'; floorClear(); }
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
        <span class="pinfo-portrait">${artImg(m.art && m.art.icon, m.portrait, 'pinfo')}</span>
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
        <i class="off-note">残り ${run.cooldowns[i]} ターン</i></span>
      </div>`;
    box.appendChild(div);
  });
  $('partyInfoModal').classList.add('show');
}

/* ===================== ターン解決 ===================== */
/**
 * 1コンボぶんの各キャラの行動を計算する。
 * 自分のオーラが消えていないキャラは行動しない(攻撃しない)。
 */
function resolveStep(groups, chain) {
  const countByColor = {};
  const groupsByColor = {};
  groups.forEach(g => {
    countByColor[g.color] = (countByColor[g.color] || 0) + g.cells.length;
    groupsByColor[g.color] = (groupsByColor[g.color] || 0) + 1;
  });

  const chainMult = 1 + (chain - 1) * COMBO_BONUS;
  const simulMult = 1 + (groups.length - 1) * SIMUL_BONUS;
  const lsComboMult = comboMultiplier(run.mods, chain);
  const buffMult = run.buffs.atk ? run.buffs.atk.mult : 1;

  const actions = [];
  run.party.members.forEach((m, i) => {
    const n = countByColor[m.aura] || 0;
    if (n <= 0) return;                       // 自分のオーラを消していない → 行動しない
    const auraKey = COLORS[m.aura];
    const orbMult = 1 + Math.max(0, n - run.matchMin) * ORB_BONUS;
    if (m.aura === HEAL_COLOR) {
      const heal = Math.round(m.rcv * HEAL_SCALE * orbMult * chainMult * run.mods.rcv);
      actions.push({ index: i, kind: 'heal', value: heal, orbs: n });
    } else {
      const dmg = Math.round(
        m.atk * ATTACK_SCALE * orbMult * chainMult * simulMult
        * auraMultiplier(run.mods, auraKey) * lsComboMult * buffMult
      );
      actions.push({ index: i, kind: 'dmg', value: dmg, orbs: n });
    }
  });
  return { actions, countByColor };
}

async function resolveTurn() {
  bstate = 'resolving';
  $('timerFill').style.width = '0%';
  run.stats.turns++;

  let chain = 0, turnDamage = 0, turnHeal = 0, anyAction = false;
  while (true) {
    const groups = findGroups(board, run.matchMin);
    if (groups.length === 0) break;
    chain++;

    const { actions } = resolveStep(groups, chain);
    const stepDamage = actions.filter(a => a.kind === 'dmg').reduce((s, a) => s + a.value, 0);
    const stepHeal = actions.filter(a => a.kind === 'heal').reduce((s, a) => s + a.value, 0);
    turnDamage += stepDamage;
    turnHeal += stepHeal;
    if (actions.length) anyAction = true;

    let html = `<span class="chain">${chain} COMBO</span>`;
    if (stepDamage > 0) html += ` <span class="dmg">${stepDamage} ダメージ</span>`;
    if (stepHeal > 0) html += ` <span class="heal">+${stepHeal} 回復</span>`;
    if (groups.length > 1) html += ` <span class="simul">同時${groups.length}消し</span>`;
    if (!actions.length) html += ' <span class="miss">攻撃できるキャラなし</span>';
    showBanner(html);

    clearingCells = groups.flatMap(g => g.cells);
    clearStart = performance.now();
    actions.forEach(a => popUnit(a.index, (a.kind === 'heal' ? '+' : '') + a.value, a.kind));
    await sleep(270);

    groups.forEach(g => g.cells.forEach(([r, c]) => { board[r][c] = -1; }));
    clearingCells = [];

    if (stepHeal > 0) run.playerHP = Math.min(run.maxHP, run.playerHP + stepHeal);
    if (stepDamage > 0) {
      run.enemyHP = Math.max(0, run.enemyHP - stepDamage);
      shake($('enemyStage'));
    }
    updateHPUI(stepDamage > 0, stepHeal > 0);

    await sleep(110);
    applyGravityNoRefill(board);
    await sleep(190);
    if (run.enemyHP <= 0) break;
  }

  run.stats.maxChain = Math.max(run.stats.maxChain, chain);
  run.stats.totalDamage += turnDamage;
  run.stats.totalHeal += turnHeal;
  await sleep(220);

  if (run.enemyHP <= 0) { hideBanner(); await floorClear(); return; }

  // 盤面が枯れて詰まないよう空きマスを補充する
  if (refillBoard(board, run.matchMin) > 0) await sleep(180);

  if (chain === 0) {
    showBanner('<span class="miss">オーラが消えなかった…</span>');
    await sleep(650);
  } else if (!anyAction) {
    showBanner('<span class="miss">オーラが合わず誰も攻撃できない!</span>');
    await sleep(650);
  }

  // 敵の攻撃カウント
  run.enemyTurnsLeft--;
  if (run.enemyTurnsLeft <= 0) {
    let dmg = Math.max(1, run.enemyAtk + randInt(-2, 4));
    const guardRate = run.buffs.guard ? run.buffs.guard.rate : 0;
    const cut = 1 - (1 - run.mods.damageCut) * (1 - guardRate);
    dmg = Math.max(cut >= 1 ? 0 : 1, Math.round(dmg * (1 - cut)));
    run.playerHP = Math.max(0, run.playerHP - dmg);
    run.enemyTurnsLeft = run.enemyInterval;
    showBanner(dmg === 0
      ? '<span class="miss">敵の攻撃!</span> <span class="heal">ダメージを無効化!</span>'
      : `<span class="miss">敵の攻撃!</span> ${dmg} ダメージ`);
    shake($('partyBox'));
    updateHPUI(false, true);
    await sleep(750);
  }
  hideBanner();

  tickTurnEnd();
  updateHPUI(false, false);
  resetTimerUI();

  if (run.playerHP <= 0) { battleDefeat(); return; }
  bstate = 'idle';
}

/** ターン終了時のクールダウン/バフ更新 */
function tickTurnEnd() {
  run.cooldowns = run.cooldowns.map(cd => Math.max(0, cd - 1));
  ['atk', 'guard'].forEach(k => {
    const b = run.buffs[k];
    if (!b) return;
    b.turns--;
    if (b.turns <= 0) run.buffs[k] = null;
  });
  run.turnTimeBonusMs = 0;
  updateSkillUI();
}

/* ===================== フロア進行 ===================== */
async function floorClear() {
  bstate = 'resolving';
  const isLast = run.floorIndex >= FLOORS_PER_STAGE - 1;
  if (isLast) { finishRun(); return; }
  showBanner('<span class="chain">フロアクリア!</span> 次のフロアへ…');
  await sleep(1000);
  run.floorIndex++;
  // クールダウンはフロアをまたいでも引き継ぐ(1フロアぶん進める)
  run.cooldowns = run.cooldowns.map(cd => Math.max(0, cd - 1));
  loadFloor();
  renderFloorPips();
  updateSkillUI();
  showBanner(`<span class="chain">フロア ${run.floorIndex + 1}</span>`);
  await sleep(700);
  hideBanner();
  bstate = 'idle';
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

  add(crystalIdFor(stage.dropAura), (2 + randInt(0, 2)) * mult);
  // 他オーラの結晶もたまに落ちる(どのキャラも育てられるように)
  if (Math.random() < 0.55) {
    const other = randInt(0, AURAS.length - 1);
    add(crystalIdFor(other), randInt(1, 2) * mult);
  }
  const shardChance = Math.min(1, stage.shardRate * (hard ? 1.6 : 1));
  if (Math.random() < shardChance) add('mt_star', randInt(1, 2) * mult);
  return drops;
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

  // 素材ドロップと編成キャラの育成(サポートは自分のキャラではないので対象外)
  const drops = rollDrops(stage, hard);
  addMaterials(drops);
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
    return `<div class="rrow drop" style="--mt:${mt.color}">${mt.emoji} ${mt.name} <b>×${drops[id]}</b></div>`;
  }).join('');
  $('resultRewards').innerHTML = `
    <div class="rrow">💰 <b>${coin}</b></div>
    <div class="rrow">🎗️ <b>${frepo}</b></div>
    ${orb ? `<div class="rrow">💎 <b>${orb}</b></div>` : ''}
    <div class="rrow">⭐ <b>EXP ${exp}</b></div>
    <div class="rrow">🧬 <b>キャラEXP ${charExp}</b></div>
    ${dropHTML}`;
  $('resultRank').innerHTML =
    (ups > 0
      ? `<div class="rankup">🎉 ランクアップ! Rank ${state.rank}
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
  $('resultTitle').textContent = 'DEFEAT';
  $('resultCard').classList.add('defeat');
  $('resultStats').innerHTML = `
    <div class="rstat"><span>到達フロア</span><b>${run.floorIndex + 1} / ${FLOORS_PER_STAGE}</b></div>
    <div class="rstat"><span>最高コンボ</span><b>${run.stats.maxChain}</b></div>
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
  if (!run) return;
  // 手番未開始なら新規開始。開始済みで時間内かつ今どのオーブも掴んでいなければ掴み直せる。
  if (bstate === 'idle') {
    bstate = 'dragging';
    dragStart = performance.now();
    autoReleased = false;
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
