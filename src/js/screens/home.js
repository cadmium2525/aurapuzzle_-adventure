/* ===================== ホーム画面 =====================
 * 最後にダンジョンへ連れて行った3人を1枚絵として見せる
 * (まだ出撃していなければ、選択中の編成で代用する)。
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
import { showScreen } from '../core/nav.js';
import { homeCharacters } from '../core/state.js';
import { AURAS, COLOR_HEX } from '../data/gamedata.js';
import { homeBanners, BANNER_INTERVAL } from '../data/banners.js';
import { updatePresentBadge } from './present.js';

/** 前面に出す人(編成内の位置)。表示上の状態なのでセーブには持たせない */
let frontIndex = 0;
/** いまDOMに並べている編成。変わったときだけ作り直す */
let builtKey = '';
let spinning = false;

/** 回転台の位置。前面から時計回りに割り当てる */
const POSITIONS = ['pos-front', 'pos-right', 'pos-left'];

function memberKey(m) {
  return `${m.id}:${(m.art && m.art.full) || m.portrait}:${artScaleOf(m)}`;
}

/**
 * イラストの寄せ具合。進化で構図が変わることがあるので、
 * 段階ごとの scale があればそちらを優先する。
 */
function artScaleOf(m) {
  return (m.art && m.art.scale) || m.artScale || 1;
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
    el.style.setProperty('--art-scale', artScaleOf(m));
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
  renderBanners();
  updatePresentBadge();
  const mons = homeCharacters();
  const art = $('homePartyArt');
  const navs = [$('homePrevBtn'), $('homeNextBtn')];

  if (!mons.length) {
    art.innerHTML = '<div class="empty">編成が空です。キャラクター → 編成 で設定しましょう。</div>';
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
  const mons = homeCharacters();
  if (mons.length < 2 || spinning) return;
  spinning = true;
  frontIndex = (frontIndex + step + mons.length) % mons.length;
  applyPositions(mons);
  setTimeout(() => { spinning = false; }, 480);   // 回りきるまで次の操作を受けない
}

/* ===================== 宣伝バナー =====================
 * 複数あるときは数秒ごとに入れ替える。左右の△で自分でも送れる。
 * 要素は一度だけ作り、`on` クラスの付け替えだけで見せ替える
 * (作り直すとCSSトランジションが効かず、その場で切り替わってしまう)。
 * ==================================================== */
let bannerTimer = null;
let bannerIndex = 0;

function showBannerAt(i) {
  const host = $('homeBanner');
  const slides = host.querySelectorAll('.bslide');
  if (!slides.length) return;
  bannerIndex = ((i % slides.length) + slides.length) % slides.length;
  slides.forEach((el, n) => el.classList.toggle('on', n === bannerIndex));
  host.querySelectorAll('.bpips i').forEach((el, n) => el.classList.toggle('on', n === bannerIndex));
}

/** 手で送る。自動送りの間隔も数え直して、すぐ次へ飛ばないようにする */
function stepBanner(step, count) {
  showBannerAt(bannerIndex + step);
  startBannerRotation(count);
}

/** バナーを組み立てる。画面を開くたびに呼ばれるが、中身が同じなら作り直さない */
function renderBanners() {
  const host = $('homeBanner');
  const list = homeBanners();
  host.hidden = list.length === 0;
  if (!list.length) { stopBannerRotation(); host.innerHTML = ''; return; }

  const key = list.map(b => b.key).join('|');
  if (host.dataset.key !== key) {
    host.dataset.key = key;
    const many = list.length > 1;
    // 送りの△はバナーの外(左右)に置く。絵の上に重ねると
    // バナー自体が見えにくく、飛び先を押すつもりで送ってしまう
    host.innerHTML = `
      ${many ? '<button class="bnav left" data-step="-1" aria-label="前のバナー"></button>' : ''}
      <div class="bcol">
        <div class="bframe">
          ${list.map((b, i) => `
            <button class="bslide${i === 0 ? ' on' : ''}" data-go="${i}" aria-label="${b.alt}">
              <img src="./${b.image}" alt="${b.alt}">
            </button>`).join('')}
        </div>
        ${many ? `<div class="bpips" aria-hidden="true">${list.map((_, i) =>
          `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      </div>
      ${many ? '<button class="bnav right" data-step="1" aria-label="次のバナー"></button>' : ''}`;
    bannerIndex = 0;
    host.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = list[Number(btn.dataset.go)];
        if (target) showScreen(target.screen, target.params);
      });
    });
    host.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();          // 下のバナーの飛び先へ行かせない
        stepBanner(Number(btn.dataset.step), list.length);
      });
    });
  }
  startBannerRotation(list.length);
}

/** ホームが前に出ているか(画面は .active で切り替わる) */
function homeIsVisible() {
  const el = $('screen-home');
  return !!el && el.classList.contains('active') && !document.hidden;
}

function startBannerRotation(count) {
  stopBannerRotation();
  if (count < 2) return;
  // 画面を離れたことを知らせてもらう代わりに、毎回自分で確かめて止まる。
  // nav.js から home.js を呼ぶと import が循環するため、この形にしている。
  bannerTimer = setInterval(() => {
    if (!homeIsVisible()) { stopBannerRotation(); return; }
    showBannerAt(bannerIndex + 1);
  }, BANNER_INTERVAL);
}

/** 見えていない画面のために動かし続けない */
export function stopBannerRotation() {
  if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
}

export function initHome() {
  $('homePrevBtn').addEventListener('click', () => shiftFront(-1));
  $('homeNextBtn').addEventListener('click', () => shiftFront(1));
  // 裏に回ったまま切り替え続けても意味がないので、戻ってきたら再開する
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBannerRotation();
    else if (homeIsVisible()) renderBanners();
  });
}
