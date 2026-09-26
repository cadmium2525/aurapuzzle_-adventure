/* =========================================================
 * gacha.js — ガチャ画面と召喚演出
 *
 * 演出の流れ:
 *   魔法陣が出る → オーラのオーブが集まる → フラッシュ →
 *   カード出現 → 星が1つずつ灯る → (10連は1枚ずつめくって最後に一覧)
 * 期待度は集まるオーブの色で示す(青=通常 / 金=SR以上 / 虹=SSR)。
 * 画面タップでいつでもスキップできる。
 * =======================================================*/
import { $, toast, sleep, itemIcon } from '../core/ui.js';
import { state, addCharacter, saveState } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, COLOR_HEX, COLOR_GLOW, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  FREPO_COST, ORB_COST, FREPO_COST_MULTI, ORB_COST_MULTI, MULTI_PULL,
  MAX_GACHA_RARITY,
  resolveCharacter
} from '../data/gamedata.js';
import { stars, portraitHTML } from './parts.js';
import { gachaCampaignsAt, gachaRates, drawGacha } from '../data/gacha-campaigns.js';
import { charDetailHTML } from './parts.js';

/* ===================== 抽選 ===================== */
let selectedCampaign = 'normal';
function rollOne(campaign, kind, guaranteed) {
  const base = drawGacha(campaign, kind, guaranteed);
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
  const campaign = gachaCampaignsAt().find(c => c.id === selectedCampaign);
  if (!campaign || !gachaRates(campaign, kind).length) {
    toast('このガチャは開催期間外です'); renderGacha(); return;
  }
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
    const hasHigh = rolls.some(r => r.base.rarity >= (useOrb ? 3 : 2));
    rolls.push(rollOne(campaign, kind, isLast && !hasHigh));
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
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent = rate => (rate * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';

export function renderGacha(options = {}) {
  if (options.campaignId || options.eventId) selectedCampaign = options.campaignId || options.eventId;
  const campaigns = gachaCampaignsAt();
  const campaign = campaigns.find(c => c.id === selectedCampaign) || campaigns[0];
  selectedCampaign = campaign.id;
  let tabs = $('gachaTabs');
  if (!tabs) {
    tabs = document.createElement('div'); tabs.id = 'gachaTabs'; tabs.className = 'segmented gacha-tabs';
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'ガチャの種類');
    $('screen-gacha').prepend(tabs);
  }
  tabs.innerHTML = campaigns.map(c => `<button role="tab" aria-selected="${c.id === campaign.id}" class="${c.id === campaign.id ? 'active' : ''}" data-campaign="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  tabs.querySelectorAll('[data-campaign]').forEach(button => button.onclick = () => {
    if (animating) return;
    selectedCampaign = button.dataset.campaign; renderGacha();
  });
  const rates = gachaRates(campaign);
  const box = $('pickupBox');
  box.hidden = !campaign.pickups.length;
  box.className = 'pickup-card campaign-pickups';
  box.innerHTML = `
    ${campaign.banner ? `<img class="gacha-banner" src="${esc(campaign.banner)}" alt="${esc(campaign.name)}">` : ''}
    <h3>${esc(campaign.name)} PICK UP</h3>
    ${campaign.availableUntil ? `<p>開催終了：${new Date(campaign.availableUntil).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間）</p>` : ''}
    <div class="gacha-pu-grid">${campaign.pickups.map(base => {
      const ch = resolveCharacter(base.id, base.rarity, 1);
      const rate = rates.find(r => r.character.id === ch.id)?.rate || 0;
      return `<button class="gacha-pu" data-pickup="${esc(ch.id)}">
        ${portraitHTML(ch)}<b>${esc(ch.name)}</b><span>★${ch.rarity} ・ ${percent(rate)}</span>
        ${ch.eventDropBonusChance ? '<span class="chip">🍬 キャンディ特効</span>' : ''}
        <small>タップでスキル・詳細</small></button>`;
    }).join('')}</div>
    ${campaign.id !== 'normal' ? '<p>限定衣装はこのガチャから登場。獲得後はイベント終了後も使用できます。</p>' : ''}`;
  box.querySelectorAll('[data-pickup]').forEach(button => button.onclick = () => {
    const ch = resolveCharacter(button.dataset.pickup, undefined, 1);
    let modal = $('gachaDetail');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'gachaDetail'; modal.className = 'modal';
      $('screen-gacha').appendChild(modal);
    }
    modal.innerHTML = `<div class="modal-card"><div>${charDetailHTML(ch)}</div><button class="btn block" data-back-close>閉じる</button></div>`;
    modal.querySelector('button').onclick = () => modal.classList.remove('show');
    modal.classList.add('show');
  });
  $('screen-gacha').querySelector('.g-frepo').hidden = campaign.id !== 'normal';
  $('screen-gacha').querySelector('.g-orb .gtitle').innerHTML = `${itemIcon('orb')} ${esc(campaign.name)}`;
  $('orbGachaNote').textContent = campaign.pickups.length ? 'ピックアップ開催中 ・ 最高レア SSR(★4)' : '最高レア SSR(★4)';
  $('frepoCost1').textContent = FREPO_COST.toLocaleString();
  $('frepoCost10').textContent = FREPO_COST_MULTI.toLocaleString();
  $('orbCost1').textContent = ORB_COST;
  $('orbCost10').textContent = ORB_COST_MULTI;
  const kinds = campaign.id === 'normal' ? ['orb', 'frepo'] : ['orb'];
  $('gachaRates').innerHTML = kinds.map(kind => {
    const ordinary = gachaRates(campaign, kind);
    const guaranteed = gachaRates(campaign, kind, true);
    const bands = [1,2,3,4].map(star => {
      const rate = ordinary.filter(r => r.character.rarity === star).reduce((sum,r) => sum+r.rate,0);
      return rate ? `<span class="rate-item"><b>★${star}</b>${percent(rate)}</span>` : '';
    }).join('');
    return `<div class="rate-row"><b>${kind === 'orb' ? esc(campaign.name) : 'フレポ召喚'}</b><div class="rate-items">${bands}</div></div>
      <details class="gacha-probabilities"><summary>キャラクター別の提供割合</summary>
      <p>通常抽選と保証抽選の1枠あたりの確率です。10連の最初の9枠に★${kind === 'orb' ? 3 : 2}以上が出なかった場合のみ、最後の1枠が保証抽選になります。</p>
      <table><thead><tr><th>キャラクター</th><th>通常</th><th>保証</th></tr></thead><tbody>
      ${ordinary.slice().sort((a,b) => Number(b.pickup)-Number(a.pickup) || b.character.rarity-a.character.rarity).map(row => `<tr><td>${row.pickup ? 'PU ' : ''}★${row.character.rarity} ${esc(row.character.name)}</td><td>${percent(row.rate)}</td><td>${percent(guaranteed.find(r=>r.character.id===row.character.id)?.rate || 0)}</td></tr>`).join('')}
      </tbody></table><p>表示は小数第3位まで丸めています。</p></details>`;
  }).join('') + '<p class="rate-note">★5は進化で到達できます。10連は1回ぶんお得です。</p>';
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
