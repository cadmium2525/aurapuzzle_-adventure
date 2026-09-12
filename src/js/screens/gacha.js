/* ===================== ガチャ画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, addCharacter, saveState } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, CHARACTERS, COLOR_HEX, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  FREPO_POOL, FREPO_WEIGHTS, ORB_WEIGHTS, FREPO_COST, ORB_COST,
  leaderSkillOf, skillOf
} from '../data/gamedata.js';
import { stars } from './parts.js';

function pullFrom(pool, rarityWeights) {
  const byRarity = {};
  pool.forEach(c => { (byRarity[c.rarity] = byRarity[c.rarity] || []).push(c); });
  const rarities = Object.keys(byRarity).map(Number).sort((a, b) => a - b);
  const total = rarities.reduce((s, r) => s + (rarityWeights[r] || 0), 0);
  let roll = Math.random() * total;
  let chosen = rarities[0];
  for (const r of rarities) {
    const w = rarityWeights[r] || 0;
    if (roll < w) { chosen = r; break; }
    roll -= w;
  }
  const cands = byRarity[chosen];
  return cands[Math.floor(Math.random() * cands.length)];
}

function showPullResult(ch, isNew) {
  const aura = AURAS[ch.aura];
  const ls = leaderSkillOf(ch), sk = skillOf(ch);
  const card = $('pullCard');
  card.className = 'modal-card r' + ch.rarity;
  card.style.setProperty('--rare', RARITY_HEX[ch.rarity]);
  card.style.setProperty('--aura', COLOR_HEX[aura.key]);
  $('pullEmoji').textContent = ch.portrait;
  $('pullName').innerHTML = `${ch.name}${isNew ? '<span class="newtag">NEW</span>' : ''}
    <span class="pjob">${ch.job}</span>`;
  $('pullStars').innerHTML = `${stars(ch.rarity)}
    <span class="rarity-tag" style="--rare:${RARITY_HEX[ch.rarity]}">${RARITY_TITLE[ch.rarity]}</span>`;
  $('pullStats').innerHTML =
    `${aura.emoji}${aura.name}オーラ ・ ${ROLE_LABEL[ch.role]}<br>ATK ${ch.atk} / HP ${ch.hp} / RCV ${ch.rcv}`;
  $('pullSkills').innerHTML = `
    <div class="skill-line on"><span class="skill-tag ls">LS</span><span><b>${ls.name}</b><br>${ls.desc}</span></div>
    <div class="skill-line on"><span class="skill-tag sk">SKILL</span><span><b>${sk.name}</b><br>${sk.desc}</span></div>`;
  $('pullOverlay').classList.add('show');
  updateStatusBar();
}

function renderRates() {
  const box = $('gachaRates');
  if (!box) return;
  box.innerHTML = '';
  const rows = [
    { label: '🎗️ フレポガチャ', weights: FREPO_WEIGHTS },
    { label: '💎 オーブガチャ', weights: ORB_WEIGHTS }
  ];
  rows.forEach(r => {
    const total = Object.values(r.weights).reduce((s, v) => s + v, 0);
    const bars = Object.keys(r.weights).map(k => {
      const pct = (r.weights[k] / total * 100).toFixed(1);
      return `<span class="rate-item" style="--rare:${RARITY_HEX[k]}">
        <b>${RARITY_TITLE[k]}</b>${pct}%</span>`;
    }).join('');
    const div = document.createElement('div');
    div.className = 'rate-row';
    div.innerHTML = `<div class="rate-label">${r.label}</div><div class="rate-items">${bars}</div>`;
    box.appendChild(div);
  });
}

export function renderGacha() { renderRates(); }

export function initGacha() {
  $('frepoGachaBtn').addEventListener('click', () => {
    if (state.frepo < FREPO_COST) { toast('フレポが足りません'); return; }
    state.frepo -= FREPO_COST;
    const ch = pullFrom(FREPO_POOL, FREPO_WEIGHTS);
    const isNew = !(state.characters[ch.id] > 0);
    addCharacter(ch.id); saveState();
    showPullResult(ch, isNew);
  });
  $('orbGachaBtn').addEventListener('click', () => {
    if (state.orb < ORB_COST) { toast('オーブが足りません'); return; }
    state.orb -= ORB_COST;
    const ch = pullFrom(CHARACTERS, ORB_WEIGHTS);
    const isNew = !(state.characters[ch.id] > 0);
    addCharacter(ch.id); saveState();
    showPullResult(ch, isNew);
  });
  $('pullCloseBtn').addEventListener('click', () => $('pullOverlay').classList.remove('show'));
}
