/* =========================================================
 * gacha.js — ガチャ画面と召喚演出
 *
 * 演出の流れ:
 *   魔法陣が出る → オーラのオーブが集まる → フラッシュ →
 *   カード出現 → 星が1つずつ灯る → (10連は1枚ずつめくって最後に一覧)
 * 期待度は集まるオーブの色で示す(青=通常 / 金=SR以上 / 虹=SSR)。
 * 画面タップでいつでもスキップできる。
 * =======================================================*/
import { $, toast, sleep } from '../core/ui.js';
import { state, addCharacter, saveState, resolveOwned } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, COLOR_HEX, COLOR_GLOW, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  GACHA_POOL, FREPO_POOL, FREPO_WEIGHTS, ORB_WEIGHTS,
  FREPO_GUARANTEE_WEIGHTS, ORB_GUARANTEE_WEIGHTS,
  FREPO_COST, ORB_COST, FREPO_COST_MULTI, ORB_COST_MULTI, MULTI_PULL,
  PICKUP_CHARACTER, PICKUP_RATE, MAX_GACHA_RARITY,
  resolveCharacter
} from '../data/gamedata.js';
import { stars, portraitHTML } from './parts.js';

/* ===================== 抽選 ===================== */
function pickRarity(weights) {
  const rarities = Object.keys(weights).map(Number).sort((a, b) => a - b);
  const total = rarities.reduce((s, r) => s + weights[r], 0);
  let roll = Math.random() * total;
  for (const r of rarities) {
    if (roll < weights[r]) return r;
    roll -= weights[r];
  }
  return rarities[rarities.length - 1];
}

function pullFrom(pool, weights) {
  const rarity = pickRarity(weights);
  // ピックアップ:最高レアを引いたときは一定確率で看板キャラになる
  const pickupOn = PICKUP_CHARACTER && rarity >= MAX_GACHA_RARITY && pool.includes(PICKUP_CHARACTER);
  if (pickupOn && Math.random() < PICKUP_RATE) return PICKUP_CHARACTER;
  // ピックアップ枠を外したあとの通常枠に看板キャラを残すと、
  // PICKUP_RATE より出やすくなってしまうのでここでは除外する
  const cands = pool.filter(c => c.rarity === rarity && !(pickupOn && c === PICKUP_CHARACTER));
  if (!cands.length) return pool[Math.floor(Math.random() * pool.length)];
  return cands[Math.floor(Math.random() * cands.length)];
}

/** 1回ぶんの抽選結果(所持前の判定込み) */
function rollOne(pool, weights) {
  const base = pullFrom(pool, weights);
  const isNew = !state.characters[base.id];
  return { base, isNew };
}

/* ===================== 演出 ===================== */
let skipRequested = false;
let animating = false;

/** タップされたら以降の待ち時間を飛ばす */
function waitStep(ms) {
  if (skipRequested) return Promise.resolve();
  return sleep(ms);
}

function stageEl() { return $('gachaStage'); }

function setStagePhase(phase) {
  const el = stageEl();
  el.dataset.phase = phase;
}

/** 期待度に応じた演出の色 */
function tierOf(rarity) {
  if (rarity >= 4) return 'rainbow';
  if (rarity === 3) return 'gold';
  return 'blue';
}

/** 収束するオーブを作る */
function buildOrbs(tier) {
  const box = $('gachaOrbs');
  box.innerHTML = '';
  const palette = tier === 'rainbow'
    ? [COLOR_HEX.c0, COLOR_HEX.c1, COLOR_HEX.c2, COLOR_HEX.c3, '#FFD86B']
    : tier === 'gold'
      ? ['#FFD86B', '#FFC65C', '#FFE9A8']
      : [COLOR_HEX.c1, COLOR_GLOW.c1, '#7FB6FF'];
  const n = tier === 'rainbow' ? 26 : tier === 'gold' ? 20 : 14;
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('span');
    const angle = (360 / n) * i + Math.random() * 12;
    const dist = 130 + Math.random() * 90;
    sp.className = 'gs-orb';
    sp.style.setProperty('--a', angle + 'deg');
    sp.style.setProperty('--d', dist + 'px');
    sp.style.setProperty('--c', palette[i % palette.length]);
    sp.style.setProperty('--delay', (Math.random() * 0.45).toFixed(2) + 's');
    sp.style.setProperty('--size', (6 + Math.random() * 10).toFixed(1) + 'px');
    box.appendChild(sp);
  }
}

/** 召喚アニメーション本体。最高レアリティに応じて演出を変える */
async function playSummon(topRarity) {
  const tier = tierOf(topRarity);
  const el = stageEl();
  el.className = 'gacha-stage show tier-' + tier;
  buildOrbs(tier);

  setStagePhase('circle');
  await waitStep(tier === 'blue' ? 700 : 1000);

  setStagePhase('gather');
  await waitStep(tier === 'blue' ? 800 : 1100);

  // 期待度の高いときは一度「溜め」を入れる
  if (tier !== 'blue') {
    $('gachaTease').textContent = tier === 'rainbow' ? 'SSR 確定!' : 'SR 以上!';
    setStagePhase('charge');
    await waitStep(tier === 'rainbow' ? 1000 : 700);
  }

  setStagePhase('flash');
  await waitStep(320);
}

function hideStage() {
  const el = stageEl();
  el.className = 'gacha-stage';
  el.dataset.phase = '';
  $('gachaOrbs').innerHTML = '';
}

/* ===================== 結果表示 ===================== */
function resultCardHTML(ch, isNew) {
  const aura = AURAS[ch.aura];
  const ls = ch.leaderSkill, sk = ch.skill;
  return `
    <div class="pull-burst"></div>
    <div class="pemoji">${portraitHTML(ch, 'big')}</div>
    <div class="pname">${ch.name}${isNew ? '<span class="newtag">NEW</span>' : ''}
      <span class="pjob">${ch.job}</span></div>
    <div class="pstars">${stars(ch.rarity, MAX_GACHA_RARITY)}
      <span class="rarity-tag" style="--rare:${RARITY_HEX[ch.rarity]}">${RARITY_TITLE[ch.rarity]}</span></div>
    <div class="pstats">${aura.emoji}${aura.name}オーラ ・ ${ROLE_LABEL[ch.role]}<br>
      ATK ${ch.atk} / HP ${ch.hp} / RCV ${ch.rcv}</div>
    <div class="pskills">
      <div class="skill-line on"><span class="skill-tag ls">LS</span><span><b>${ls.name}</b><br>${ls.desc}</span></div>
      <div class="skill-line on"><span class="skill-tag sk">SKILL</span><span><b>${sk.name}</b><br>${sk.desc}</span></div>
    </div>`;
}

/** 1体ぶんのカードを出す */
async function revealOne(ch, isNew, index, total) {
  const card = $('pullCard');
  card.className = 'modal-card r' + ch.rarity;
  card.style.setProperty('--rare', RARITY_HEX[ch.rarity]);
  card.style.setProperty('--aura', COLOR_HEX[AURAS[ch.aura].key]);
  $('pullBody').innerHTML = resultCardHTML(ch, isNew);
  $('pullCounter').textContent = total > 1 ? `${index + 1} / ${total}` : '';
  $('pullCounter').style.display = total > 1 ? 'block' : 'none';
  $('pullOverlay').classList.add('show');
  // 星を1つずつ灯す
  const starEls = $('pullBody').querySelectorAll('.stars');
  if (starEls.length) starEls[0].classList.add('pop-in');
  await waitStep(total > 1 ? 620 : 300);
}

/** 10連のまとめ一覧 */
function renderSummary(results) {
  const box = $('pullSummary');
  box.innerHTML = results.map(r => {
    const ch = r.ch;
    return `<div class="ps-cell r${ch.rarity}" style="--rare:${RARITY_HEX[ch.rarity]}">
      ${portraitHTML(ch)}
      <span class="ps-name">${ch.name}</span>
      <span class="ps-star">${'★'.repeat(ch.rarity)}</span>
      ${r.isNew ? '<span class="ps-new">NEW</span>' : ''}
    </div>`;
  }).join('');
  $('pullSummaryWrap').style.display = 'block';
  $('pullBody').style.display = 'none';
  $('pullCounter').style.display = 'none';
  $('pullSkipBtn').style.display = 'none';
  const card = $('pullCard');
  card.className = 'modal-card wide summary';
}

/* ===================== ガチャ実行 ===================== */
async function doPull(kind, count) {
  if (animating) return;
  const useOrb = kind === 'orb';
  const pool = useOrb ? GACHA_POOL : FREPO_POOL;
  const weights = useOrb ? ORB_WEIGHTS : FREPO_WEIGHTS;
  const guarantee = useOrb ? ORB_GUARANTEE_WEIGHTS : FREPO_GUARANTEE_WEIGHTS;
  const cost = count > 1
    ? (useOrb ? ORB_COST_MULTI : FREPO_COST_MULTI)
    : (useOrb ? ORB_COST : FREPO_COST);
  const have = useOrb ? state.orb : state.frepo;
  if (have < cost) { toast(useOrb ? 'オーブが足りません' : 'フレポが足りません'); return; }

  animating = true;
  skipRequested = false;
  if (useOrb) state.orb -= cost; else state.frepo -= cost;

  // 抽選(10連は最後の1枠が★3以上確定)
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const isLast = count > 1 && i === count - 1;
    const hasHigh = rolls.some(r => r.base.rarity >= 3);
    rolls.push(rollOne(pool, (isLast && !hasHigh) ? guarantee : weights));
  }
  rolls.forEach(r => addCharacter(r.base.id));
  saveState();
  updateStatusBar();

  const results = rolls.map(r => ({
    ch: resolveCharacter(r.base.id, r.base.rarity, 1),
    isNew: r.isNew
  }));
  const topRarity = Math.max(...results.map(r => r.ch.rarity));

  // 演出 → 1枚ずつ公開
  $('pullSummaryWrap').style.display = 'none';
  $('pullBody').style.display = 'block';
  $('pullSkipBtn').style.display = count > 1 ? 'block' : 'none';
  await playSummon(topRarity);
  hideStage();

  for (let i = 0; i < results.length; i++) {
    await revealOne(results[i].ch, results[i].isNew, i, results.length);
    if (skipRequested && results.length > 1) break;
  }
  if (results.length > 1) renderSummary(results);
  animating = false;
}

/* ===================== 画面 ===================== */
export function renderGacha() {
  // ピックアップ表示
  const box = $('pickupBox');
  if (box && PICKUP_CHARACTER) {
    const ch = resolveCharacter(PICKUP_CHARACTER.id, PICKUP_CHARACTER.rarity, 1);
    const aura = AURAS[ch.aura];
    box.style.setProperty('--aura', COLOR_HEX[aura.key]);
    box.innerHTML = `
      <div class="pu-label">PICK UP</div>
      ${portraitHTML(ch, 'big')}
      <div class="pu-info">
        <div class="pu-name">${ch.name}</div>
        <div class="pu-job">${ch.job} ・ ${aura.emoji}${aura.name}オーラ</div>
        ${stars(ch.rarity, MAX_GACHA_RARITY)}
        <div class="pu-ls"><span class="mini-tag ls">LS</span>${ch.leaderSkill.name}
          <span class="pu-lsdesc">${ch.leaderSkill.desc}</span></div>
      </div>`;
  }

  // コスト表示
  $('frepoCost1').textContent = FREPO_COST.toLocaleString();
  $('frepoCost10').textContent = FREPO_COST_MULTI.toLocaleString();
  $('orbCost1').textContent = ORB_COST;
  $('orbCost10').textContent = ORB_COST_MULTI;

  // 排出率
  const rates = $('gachaRates');
  if (!rates) return;
  const rows = [
    { label: '🎗️ フレポガチャ', weights: FREPO_WEIGHTS },
    { label: '💎 オーブガチャ', weights: ORB_WEIGHTS }
  ];
  rates.innerHTML = rows.map(r => {
    const total = Object.values(r.weights).reduce((s, v) => s + v, 0);
    const items = Object.keys(r.weights).map(k =>
      `<span class="rate-item" style="--rare:${RARITY_HEX[k]}"><b>${RARITY_TITLE[k]}</b>${(r.weights[k] / total * 100).toFixed(1)}%</span>`
    ).join('');
    return `<div class="rate-row"><div class="rate-label">${r.label}</div><div class="rate-items">${items}</div></div>`;
  }).join('')
    + `<div class="rate-note">★5(UR)はガチャからは出ません。★4まで育てて「進化」で到達します。<br>
       ${MULTI_PULL}連は1回ぶんお得＆★3以上が1体確定です。</div>`;
}

export function initGacha() {
  $('frepoGacha1Btn').addEventListener('click', () => doPull('frepo', 1));
  $('frepoGacha10Btn').addEventListener('click', () => doPull('frepo', MULTI_PULL));
  $('orbGacha1Btn').addEventListener('click', () => doPull('orb', 1));
  $('orbGacha10Btn').addEventListener('click', () => doPull('orb', MULTI_PULL));

  // 演出中のタップでスキップ
  stageEl().addEventListener('click', () => { skipRequested = true; });
  $('pullSkipBtn').addEventListener('click', () => { skipRequested = true; });

  $('pullCloseBtn').addEventListener('click', () => {
    if (animating) { skipRequested = true; return; }
    $('pullOverlay').classList.remove('show');
  });
}
