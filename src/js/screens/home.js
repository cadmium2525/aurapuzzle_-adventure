/* ===================== ホーム画面 =====================
 * 編成中の3人を1枚絵として見せる。
 * 3人を回転台(ターンテーブル)の上に並べ、前面・右奥・左奥の3つの位置を
 * 持ち回る。切り替えは位置そのものを動かすので、キャラが円周上を移動して
 * 入れ替わって見える。
 *
 * そのため要素は作り直さず、位置クラスの付け替えだけで動かしている。
 * 作り直すとCSSトランジションが効かず、その場で切り替わるだけになる。
 *
 * 左右の△は「見せ方」だけの操作で、リーダー(編成の先頭)は変わらない。
 * ==================================================== */
import { $, artImg } from '../core/ui.js';
import { ownCharacters } from '../core/state.js';
import { AURAS, COLOR_HEX } from '../data/gamedata.js';

/** 前面に出す人(編成内の位置)。表示上の状態なのでセーブには持たせない */
let frontIndex = 0;
/** いまDOMに並べている編成。変わったときだけ作り直す */
let builtKey = '';
let spinning = false;

/** 回転台の位置。前面から時計回りに割り当てる */
const POSITIONS = ['pos-front', 'pos-right', 'pos-left'];

function memberKey(m) {
  return `${m.id}:${(m.art && m.art.full) || m.portrait}:${m.artScale || 1}`;
}

/** 3人ぶんの要素を作る。中身の作り直しはここだけ */
function build(art, mons) {
  art.innerHTML = '';
  mons.forEach(m => {
    const aura = AURAS[m.aura];
    const el = document.createElement('div');
    el.className = 'hp-slot';
    // イラストごとに余白の量が違うので、キャラ側の artScale で寄せ具合を補正する
    el.style.setProperty('--aura', COLOR_HEX[aura.key]);
    el.style.setProperty('--art-scale', m.artScale || 1);
    el.innerHTML = artImg(m.art && m.art.full, m.portrait, 'hp');
    art.appendChild(el);
  });
}

/** 誰をどの位置に置くかだけを更新する(ここが回転そのもの) */
function applyPositions(mons) {
  const art = $('homePartyArt');
  const leader = mons[0];                       // 編成の先頭が常にリーダー
  [...art.children].forEach((el, i) => {
    const slot = (i - frontIndex + mons.length) % mons.length;
    POSITIONS.forEach(p => el.classList.remove(p));
    el.classList.add(POSITIONS[slot] || 'pos-left');
    el.classList.toggle('is-leader', mons[i] === leader);
  });
}

export function renderHome() {
  const mons = ownCharacters();
  const art = $('homePartyArt');
  const navs = [$('homePrevBtn'), $('homeNextBtn')];

  if (!mons.length) {
    art.innerHTML = '<div class="empty">編成が空です。キャラクター画面で設定しましょう。</div>';
    builtKey = '';
    navs.forEach(b => { if (b) b.hidden = true; });
    return;
  }

  // 編成が変わって位置がずれても破綻しないようにする
  if (frontIndex >= mons.length) frontIndex = 0;
  navs.forEach(b => { if (b) b.hidden = mons.length < 2; });

  const key = mons.map(memberKey).join('|');
  if (key !== builtKey) { build(art, mons); builtKey = key; }
  applyPositions(mons);
}

/** 前面に出す人をずらす(リーダーは変わらない) */
function shiftFront(step) {
  const mons = ownCharacters();
  if (mons.length < 2 || spinning) return;
  spinning = true;
  frontIndex = (frontIndex + step + mons.length) % mons.length;
  applyPositions(mons);
  setTimeout(() => { spinning = false; }, 480);   // 回りきるまで次の操作を受けない
}

export function initHome() {
  $('homePrevBtn').addEventListener('click', () => shiftFront(-1));
  $('homeNextBtn').addEventListener('click', () => shiftFront(1));
}
