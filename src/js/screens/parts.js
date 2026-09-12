/* ===================== 共通UIパーツ ===================== */
import {
  AURAS, COLOR_HEX, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  MAX_RARITY, expToNextCharLevel
} from '../data/gamedata.js';

/** ★表示(獲得ぶんは金、残りは薄く) */
export function stars(n, max) {
  const total = max || MAX_RARITY;
  return `<span class="stars">${'★'.repeat(n)}<span class="dim">${'★'.repeat(Math.max(0, total - n))}</span></span>`;
}

/**
 * イラストの差し込み。
 * 画像が用意されていればそれを使い、読み込めなければ絵文字に戻す。
 * (assets/chars/ に画像を置くまでは絵文字のまま動く)
 */
function artImg(src, emoji, cls) {
  if (!src) return `<span class="${cls}-emoji">${emoji}</span>`;
  return `<img class="${cls}-img" src="${src}" alt="" loading="lazy"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}-emoji',textContent:'${emoji}'}))">`;
}

/** キャラの丸いポートレート(オーラ色のリング付き) */
export function portraitHTML(ch, size) {
  const aura = AURAS[ch.aura];
  const icon = ch.art && ch.art.icon;
  return `<span class="portrait ${size || ''} r${ch.star || ch.rarity}${ch.evolved ? ' evolved' : ''}"
    style="--aura:${COLOR_HEX[aura.key]};--rare:${RARITY_HEX[ch.star || ch.rarity]}">
    <span class="p-face">${artImg(icon, ch.portrait, 'p')}</span>
    <span class="p-aura">${aura.emoji}</span>
  </span>`;
}

/** レベルバー */
export function levelBarHTML(ch) {
  if (!ch.level) return '';
  const atMax = ch.level >= ch.maxLevel;
  const need = expToNextCharLevel(ch.level);
  const pct = atMax ? 100 : Math.min(100, (ch.xp || 0) / need * 100);
  return `<div class="lvbar${atMax ? ' max' : ''}">
      <span class="lvnum">Lv<b>${ch.level}</b><i>/${ch.maxLevel}</i></span>
      <span class="lvtrack"><span class="lvfill" style="width:${pct}%"></span></span>
      ${atMax ? '<span class="lvmax">MAX</span>' : ''}
    </div>`;
}

/** 一覧用の1行カード(中身のみ。外側の .char-row は呼び出し側で用意する) */
export function charRowHTML(ch, count) {
  const aura = AURAS[ch.aura];
  const countHTML = count !== undefined && count > 1
    ? `<span class="owned-count">×${count}</span>` : '';
  const ls = ch.leaderSkill, sk = ch.skill;
  return `${portraitHTML(ch)}
    <div class="cinfo">
      <div class="cname">${ch.name}${countHTML}
        <span class="rarity-tag" style="--rare:${RARITY_HEX[ch.star || ch.rarity]}">${RARITY_TITLE[ch.star || ch.rarity]}</span>
        ${ch.evolved ? '<span class="evo-tag">進化</span>' : ''}
      </div>
      <div class="cmeta">${aura.emoji}${aura.name} ・ ${ch.job} ・ ${ROLE_LABEL[ch.role]}</div>
      <div class="cstats"><b>ATK</b>${ch.atk} <b>HP</b>${ch.hp} <b>RCV</b>${ch.rcv}</div>
      ${ch.level ? levelBarHTML(ch) : ''}
      <div class="cskills">
        <span class="mini-tag ls">LS</span>${ls ? ls.name : '—'}
        <span class="mini-tag sk">SK</span>${sk ? sk.name : '—'}
      </div>
    </div>`;
}

/** キャラ詳細(モーダル用) */
export function charDetailHTML(ch, extra) {
  const aura = AURAS[ch.aura];
  const ls = ch.leaderSkill, sk = ch.skill;
  const full = ch.art && ch.art.full;
  return `
    <div class="cd-head" style="--aura:${COLOR_HEX[aura.key]};--rare:${RARITY_HEX[ch.star || ch.rarity]}">
      ${full
        ? `<span class="cd-art">${artImg(full, ch.portrait, 'cda')}</span>`
        : portraitHTML(ch, 'big')}
      <div class="cd-id">
        <div class="cd-name">${ch.name}</div>
        <div class="cd-job">${ch.job}</div>
        ${stars(ch.star || ch.rarity)}
        <div class="cd-tags">
          <span class="chip aura">${aura.emoji} ${aura.name}オーラ</span>
          <span class="chip">${ROLE_LABEL[ch.role]}</span>
          ${ch.evolved ? '<span class="chip evo">進化済</span>' : ''}
        </div>
      </div>
    </div>
    ${ch.flavor ? `<div class="cd-flavor">${ch.flavor}</div>` : ''}
    ${ch.level ? levelBarHTML(ch) : ''}
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
