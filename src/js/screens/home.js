/* ===================== ホーム画面 =====================
 * 編成中の3人を1枚絵として見せる。
 * 1人を最前面の中央に、残り2人を左右の少し後ろへ小さく暗く重ねる。
 *
 * 左右の△で前面に出す人を入れ替えられるが、これは「見せ方」だけの操作で、
 * リーダー(編成の先頭)は変わらない。
 * ==================================================== */
import { $, artImg } from '../core/ui.js';
import { ownCharacters } from '../core/state.js';
import { AURAS, COLOR_HEX } from '../data/gamedata.js';

/** 前面に出す人(編成内の位置)。表示上の状態なのでセーブには持たせない */
let frontIndex = 0;

/**
 * 1人ぶんの立ち絵(イラストが無ければ絵文字にフォールバック)。
 * 前面に出す人は入れ替えられるので、リーダーは足元の光で示す。
 */
function slotHTML(m, cls, isLeader) {
  if (!m) return '';
  const aura = AURAS[m.aura];
  // イラストごとに余白の量が違うので、キャラ側の artScale で寄せ具合を補正する
  const scale = m.artScale || 1;
  return `<div class="hp-slot ${cls}${isLeader ? ' is-leader' : ''}"
    style="--aura:${COLOR_HEX[aura.key]};--art-scale:${scale}">
    ${artImg(m.art && m.art.full, m.portrait, 'hp')}
  </div>`;
}

export function renderHome() {
  const mons = ownCharacters();
  const art = $('homePartyArt');
  const navs = [$('homePrevBtn'), $('homeNextBtn')];

  if (!mons.length) {
    art.innerHTML = '<div class="empty">編成が空です。キャラクター画面で設定しましょう。</div>';
    navs.forEach(b => { if (b) b.hidden = true; });
    return;
  }

  // 編成が変わって位置がずれても破綻しないようにする
  if (frontIndex >= mons.length) frontIndex = 0;
  navs.forEach(b => { if (b) b.hidden = mons.length < 2; });

  const at = i => mons[(frontIndex + i) % mons.length];
  const leader = mons[0];                       // 編成の先頭が常にリーダー
  // 後ろの2人を先に描き、前面の1人を最後に重ねる
  art.innerHTML = (mons.length > 1 ? slotHTML(at(1), 'sub left',  at(1) === leader) : '')
    + (mons.length > 2 ? slotHTML(at(2), 'sub right', at(2) === leader) : '')
    + slotHTML(at(0), 'lead', at(0) === leader);
}

/**
 * 前面に出す人をずらす(リーダーは変わらない)。
 * ターンテーブルのように回して見せたいので、回転の中間で中身を差し替える。
 */
let spinning = false;
function shiftFront(step) {
  const n = ownCharacters().length;
  if (n < 2 || spinning) return;
  const art = $('homePartyArt');
  spinning = true;
  art.classList.remove('spin-r', 'spin-l');
  void art.offsetWidth;                       // アニメーションを確実に作り直す
  art.classList.add(step > 0 ? 'spin-r' : 'spin-l');
  setTimeout(() => {
    frontIndex = (frontIndex + step + n) % n;
    renderHome();
  }, 190);                                    // 横を向いた瞬間に差し替える
  setTimeout(() => {
    art.classList.remove('spin-r', 'spin-l');
    spinning = false;
  }, 420);
}

export function initHome() {
  $('homePrevBtn').addEventListener('click', () => shiftFront(-1));
  $('homeNextBtn').addEventListener('click', () => shiftFront(1));
}
