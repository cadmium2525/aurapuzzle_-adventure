/* ===================== ホーム画面 ===================== */
import { $ } from '../core/ui.js';
import { ownCharacters } from '../core/state.js';
import { AURAS, COLOR_HEX, leaderSkillOf } from '../data/gamedata.js';
import { portraitHTML, stars } from './parts.js';

export function renderHome() {
  const mons = ownCharacters();
  const box = $('homeLeaderBox');
  const row = $('homePartyRow');

  if (!mons.length) {
    box.innerHTML = '<div class="empty">編成が空です。キャラクター画面で設定しましょう。</div>';
    row.innerHTML = '';
    return;
  }

  const leader = mons[0];
  const ls = leaderSkillOf(leader);
  const aura = AURAS[leader.aura];
  box.innerHTML = `
    <div class="leader-hero" style="--aura:${COLOR_HEX[aura.key]}">
      ${portraitHTML(leader, 'big')}
      <div class="lh-info">
        <div class="lh-name">${leader.name}<span class="lh-job">${leader.job}</span></div>
        ${stars(leader.rarity)}
        <div class="lh-ls"><span class="mini-tag ls">LS</span>${ls ? ls.name : '—'}
          <span class="lh-lsdesc">${ls ? ls.desc : ''}</span></div>
      </div>
    </div>`;

  row.innerHTML = mons.map((m, i) => `
    <div class="pm-slot" style="--aura:${COLOR_HEX[AURAS[m.aura].key]}">
      ${portraitHTML(m)}
      <span class="pm-name">${m.name}</span>
      ${i === 0 ? '<span class="pm-badge">L</span>' : ''}
    </div>`).join('')
    + `<div class="pm-slot support-slot"><span class="pm-sup">🤝</span><span class="pm-name">サポート</span></div>`;
}
