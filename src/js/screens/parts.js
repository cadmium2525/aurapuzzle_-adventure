/* ===================== 共通UIパーツ ===================== */
import {
  AURAS, COLOR_HEX, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  leaderSkillOf, skillOf
} from '../data/gamedata.js';

export function stars(n) {
  return `<span class="stars">${'★'.repeat(n)}<span class="dim">${'★'.repeat(5 - n)}</span></span>`;
}

/** キャラの丸いポートレート(オーラ色のリング付き) */
export function portraitHTML(ch, size) {
  const aura = AURAS[ch.aura];
  return `<span class="portrait ${size || ''} r${ch.rarity}"
    style="--aura:${COLOR_HEX[aura.key]};--rare:${RARITY_HEX[ch.rarity]}">
    <span class="p-face">${ch.portrait}</span>
    <span class="p-aura">${aura.emoji}</span>
  </span>`;
}

/** 一覧用の1行カード(中身のみ。外側の .char-row は呼び出し側で用意する) */
export function charRowHTML(ch, count) {
  const aura = AURAS[ch.aura];
  const countHTML = count !== undefined && count > 1
    ? `<span class="owned-count">×${count}</span>` : '';
  const ls = leaderSkillOf(ch), sk = skillOf(ch);
  return `${portraitHTML(ch)}
    <div class="cinfo">
      <div class="cname">${ch.name}${countHTML}
        <span class="rarity-tag" style="--rare:${RARITY_HEX[ch.rarity]}">${RARITY_TITLE[ch.rarity]}</span>
      </div>
      <div class="cmeta">${aura.emoji}${aura.name} ・ ${ch.job} ・ ${ROLE_LABEL[ch.role]}</div>
      <div class="cstats"><b>ATK</b>${ch.atk} <b>HP</b>${ch.hp} <b>RCV</b>${ch.rcv}</div>
      <div class="cskills">
        <span class="mini-tag ls">LS</span>${ls ? ls.name : '—'}
        <span class="mini-tag sk">SK</span>${sk ? sk.name : '—'}
      </div>
    </div>`;
}

/** キャラ詳細(モーダル用) */
export function charDetailHTML(ch, extra) {
  const aura = AURAS[ch.aura];
  const ls = leaderSkillOf(ch), sk = skillOf(ch);
  return `
    <div class="cd-head" style="--aura:${COLOR_HEX[aura.key]};--rare:${RARITY_HEX[ch.rarity]}">
      ${portraitHTML(ch, 'big')}
      <div class="cd-id">
        <div class="cd-name">${ch.name}</div>
        <div class="cd-job">${ch.job}</div>
        ${stars(ch.rarity)}
        <div class="cd-tags">
          <span class="chip aura">${aura.emoji} ${aura.name}オーラ</span>
          <span class="chip">${ROLE_LABEL[ch.role]}</span>
        </div>
      </div>
    </div>
    <div class="cd-stats">
      <div><span>ATK</span><b>${ch.atk}</b></div>
      <div><span>HP</span><b>${ch.hp}</b></div>
      <div><span>RCV</span><b>${ch.rcv}</b></div>
    </div>
    <div class="skill-line on">
      <span class="skill-tag ls">LS</span>
      <span><b>${ls ? ls.name : '—'}</b><br>${ls ? ls.desc : ''}</span>
    </div>
    <div class="skill-line on">
      <span class="skill-tag sk">SKILL</span>
      <span><b>${sk ? sk.name : '—'}</b>(CT ${sk ? sk.cooldown : '-'})<br>${sk ? sk.desc : ''}</span>
    </div>
    ${extra || ''}`;
}
