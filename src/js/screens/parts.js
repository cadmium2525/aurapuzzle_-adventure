/* ===================== 共通パーツ ===================== */
import { ELEMENTS, COLOR_HEX } from '../data/gamedata.js';

export function monRowHTML(m, count) {
  const el = ELEMENTS[m.element];
  const stars = '★'.repeat(m.rarity);
  const countHTML = count !== undefined
    ? ` <span style="color:var(--ink-dim);font-weight:400;">x${count}</span>` : '';
  return `<div class="elemicon" style="background:${COLOR_HEX[el.key]}33;color:${COLOR_HEX[el.key]}">${el.emoji}</div>
    <div class="minfo">
      <div class="mname">${m.name}${countHTML}</div>
      <div class="stars">${stars}</div>
      <div class="mstats">ATK ${m.atk} / HP ${m.hp}</div>
    </div>`;
}
