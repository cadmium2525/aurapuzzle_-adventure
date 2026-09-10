/* ===================== ガチャ画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, addMonster, saveState } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  ELEMENTS, MONSTER_POOL, FREPO_WEIGHTS, ORB_WEIGHTS, FREPO_COST, ORB_COST
} from '../data/gamedata.js';

const frepoPool = MONSTER_POOL.filter(m => m.rarity <= 3);

function pullFrom(pool, rarityWeights) {
  const byRarity = {};
  pool.forEach(m => { (byRarity[m.rarity] = byRarity[m.rarity] || []).push(m); });
  const rarities = Object.keys(byRarity).map(Number);
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

function showPullResult(m) {
  const el = ELEMENTS[m.element];
  $('pullEmoji').textContent = el.emoji;
  $('pullName').textContent = m.name;
  $('pullStars').textContent = '★'.repeat(m.rarity);
  $('pullStats').textContent = `${el.name}属性 / ATK ${m.atk} / HP ${m.hp}`;
  $('pullOverlay').classList.add('show');
  updateStatusBar();
}

export function initGacha() {
  $('frepoGachaBtn').addEventListener('click', () => {
    if (state.frepo < FREPO_COST) { toast('フレポが足りません'); return; }
    state.frepo -= FREPO_COST;
    const m = pullFrom(frepoPool, FREPO_WEIGHTS);
    addMonster(m.id); saveState();
    showPullResult(m);
  });
  $('orbGachaBtn').addEventListener('click', () => {
    if (state.orb < ORB_COST) { toast('オーブが足りません'); return; }
    state.orb -= ORB_COST;
    const m = pullFrom(MONSTER_POOL, ORB_WEIGHTS);
    addMonster(m.id); saveState();
    showPullResult(m);
  });
  $('pullCloseBtn').addEventListener('click', () => $('pullOverlay').classList.remove('show'));
}
