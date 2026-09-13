/* =========================================================
 * nav.js — 画面遷移とトップバー
 * =======================================================*/
import { $, formatMMSS, artImg } from './ui.js';
import { state, tickStamina, maxStamina, staminaNextInMs, resolveOwned } from './state.js';

const TITLES = {
  home: 'ホーム', dungeon: 'ダンジョン', battle: 'バトル', event: 'イベント',
  character: 'キャラクター', gacha: 'ガチャ', shop: 'ショップ',
  mypage: 'マイページ', friends: 'フレンド', guide: 'あそびかた'
};

const renderers = {};
const backHandlers = {};
/** 画面表示時に呼ぶ描画関数を登録する */
export function registerScreen(name, fn) { renderers[name] = fn; }
/** 画面内の階層を1つ戻す処理。true を返した場合はホームへ戻らない。 */
export function registerBackHandler(name, fn) { backHandlers[name] = fn; }

export let currentScreen = 'home';

/**
 * 画面を切り替える。
 * 基本はホームから1段だけ潜る。ダンジョンだけは種別選択を挟むため、
 * backHandlers で画面内階層を先に戻す。
 */
export function showScreen(name, options = {}) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $('screen-' + name);
  if (!el) return;
  el.classList.add('active');
  $('screenTitle').textContent = TITLES[name] || '';
  $('backBtn').classList.toggle('hidden', name === 'home' || name === 'battle');
  $('statusBar').classList.toggle('hidden', name === 'battle');
  document.body.classList.toggle('in-battle', name === 'battle');
  document.body.dataset.screen = name;          // 画面ごとの背景切り替えに使う
  currentScreen = name;
  if (renderers[name]) renderers[name](options);
  updateStatusBar();
  // 画面切り替え時は先頭へ戻す
  window.scrollTo({ top: 0 });
}

/** トップバーの ‹ 。画面内階層があればそこへ、無ければホームへ戻る。 */
export function goBack() {
  const handler = backHandlers[currentScreen];
  if (handler && handler()) return;
  showScreen('home');
}

/* ===================== トップバー ===================== */
/**
 * プロフィールアイコンを描く。
 * アイコンはフレンドへの貸し出しに設定したキャラクターのもの。
 * 未設定・イラスト無しのときは絵文字にフォールバックする。
 *
 * updateStatusBar() は毎秒呼ばれるので、中身が変わっていないときは
 * DOMに触れない。作り直すと画像が読み込み直されて点滅する。
 */
function renderProfileIcon() {
  const el = $('statusProfileIcon');
  if (!el) return;
  const id = state.profile.rentalCharId;
  const ch = id ? resolveOwned(id) : null;
  const src = (ch && ch.art && ch.art.icon) || '';
  const emoji = ch ? ch.portrait : '🙂';
  const key = src || 'emoji:' + emoji;
  if (el.dataset.iconKey !== key) {
    el.dataset.iconKey = key;
    el.innerHTML = artImg(src, emoji, 'pi');
  }
  el.title = ch ? `${ch.name}(貸し出し中)` : '貸し出しキャラクターを選ぶ';
}

export function updateStatusBar() {
  tickStamina();
  const max = maxStamina();
  const over = state.stamina > max;     // ランクアップでオーバーフロー中
  $('statusPlayerName').textContent = state.profile.name || 'プレイヤー';
  renderProfileIcon();
  $('curStamina').textContent = `${state.stamina}/${max}`;
  $('curStamina').classList.toggle('over', over);
  const next = staminaNextInMs();
  $('staminaTimer').textContent = over ? 'OVER' : (next > 0 ? formatMMSS(next) : 'MAX');
  const fill = $('staminaFill');
  if (fill) {
    fill.style.width = Math.min(100, state.stamina / max * 100) + '%';
    fill.classList.toggle('over', over);
  }
  $('curRank').textContent = state.rank;
  $('curCoin').textContent = state.coin.toLocaleString();
  $('curFrepo').textContent = state.frepo.toLocaleString();
  $('curOrb').textContent = state.orb.toLocaleString();
}

export function initNav() {
  $('backBtn').addEventListener('click', goBack);
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.getAttribute('data-nav')));
  });
  // スタミナ回復表示を毎秒更新
  setInterval(updateStatusBar, 1000);
}
