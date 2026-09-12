/* ===================== あそびかた画面 ===================== */
import { $ } from '../core/ui.js';
import { AURAS, COLOR_HEX, CHARACTERS } from '../data/gamedata.js';

export function renderGuide() {
  const box = $('guideAuraList');
  box.innerHTML = '';
  AURAS.forEach((a, i) => {
    const members = CHARACTERS.filter(c => c.aura === i).length;
    const div = document.createElement('div');
    div.className = 'aura-row';
    div.style.setProperty('--aura', COLOR_HEX[a.key]);
    div.innerHTML = `<span class="aura-orb">${a.emoji}</span>
      <div class="cinfo">
        <div class="cname">${a.name}オーラ <span class="aura-label">${a.label}</span></div>
        <div class="cmeta">${a.role === 'heal'
          ? 'このオーラを消すと、癒オーラの仲間がパーティを回復します。'
          : 'このオーラを消すと、同じオーラの仲間が敵を攻撃します。'}</div>
        <div class="cstats">登場キャラクター ${members}人</div>
      </div>`;
    box.appendChild(div);
  });
}
