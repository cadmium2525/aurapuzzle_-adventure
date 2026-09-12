/* ===================== ホーム画面 =====================
 * 編成中の3人を1枚絵として見せる。
 * リーダーを最前面の中央に置き、2人目と3人目を左右の少し後ろへ
 * 小さく・暗く重ねることで、並びだけでリーダーと編成が分かるようにする。
 * ==================================================== */
import { $, artImg } from '../core/ui.js';
import { ownCharacters } from '../core/state.js';
import { AURAS, COLOR_HEX } from '../data/gamedata.js';

/** 1人ぶんの立ち絵(イラストが無ければ絵文字にフォールバック) */
function slotHTML(m, cls) {
  if (!m) return '';
  const aura = AURAS[m.aura];
  return `<div class="hp-slot ${cls}" style="--aura:${COLOR_HEX[aura.key]}">
    ${artImg(m.art && m.art.full, m.portrait, 'hp')}
  </div>`;
}

export function renderHome() {
  const mons = ownCharacters();
  const art = $('homePartyArt');

  if (!mons.length) {
    art.innerHTML = '<div class="empty">編成が空です。キャラクター画面で設定しましょう。</div>';
    return;
  }

  // 後ろの2人を先に描き、リーダーを最後に重ねて最前面にする
  art.innerHTML = slotHTML(mons[1], 'sub left')
    + slotHTML(mons[2], 'sub right')
    + slotHTML(mons[0], 'lead');
}
