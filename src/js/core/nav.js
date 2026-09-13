/* =========================================================
 * nav.js — 画面遷移とトップバー
 * =======================================================*/
import { $, formatMMSS, artImg, toast } from './ui.js';
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
  armDeviceBack();                              // 端末の戻る操作を受け止める場所を確保する
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

/* ===================== 端末の戻る操作 =====================
 * Android の戻るは popstate として届く。履歴に「身代わり」を1つ積んでおき、
 * 戻るたびにそれが消費される → こちらで処理して積み直す、という形にする。
 *
 * 受け止める順番は、手前に出ているものから。
 *   1. モーダルが開いていれば、それを閉じる
 *   2. バトル中は設定(リタイア)を開く。進行中のランを不意に捨てないため
 *   3. ホーム以外なら goBack()(画面内階層があればそこへ、無ければホーム)
 *   4. ホームなら、続けてもう一度でアプリを閉じる(1回目は知らせるだけ)
 * ======================================================== */
const BACK_GUARD = 'acb-back';
const EXIT_WINDOW_MS = 2000;
let exitHintAt = 0;

/** 身代わりが積まれていなければ積む */
function armDeviceBack() {
  if (history.state && history.state.guard === BACK_GUARD) return;
  history.pushState({ guard: BACK_GUARD }, '');
}

/** いちばん手前のモーダル(重なったときはDOMの後ろが手前) */
function topModal() {
  const open = document.querySelectorAll('.modal.show');
  return open.length ? open[open.length - 1] : null;
}

/**
 * モーダルを閉じる。閉じ方はモーダルごとに後始末が違うので、
 * data-back-close を付けたボタン(表示されているもの)を押して任せる。
 */
function closeTopModal(modal) {
  const btn = [...modal.querySelectorAll('[data-back-close]')]
    .find(b => b.offsetParent !== null);
  if (btn) btn.click();
  else modal.classList.remove('show');
}

/** @returns {boolean} アプリ内に留まるなら true */
function handleDeviceBack() {
  const modal = topModal();
  if (modal) { closeTopModal(modal); return true; }
  // バトル中は戻るで抜けさせない。リタイアの確認を出せる設定を開く
  if (currentScreen === 'battle') { $('sysBtn').click(); return true; }
  if (currentScreen !== 'home') { goBack(); return true; }

  if (Date.now() - exitHintAt < EXIT_WINDOW_MS) return false;
  exitHintAt = Date.now();
  toast('もう一度戻るでアプリを閉じます');
  return true;
}

function initDeviceBack() {
  window.addEventListener('popstate', () => {
    if (handleDeviceBack()) armDeviceBack();
    else history.back();      // 身代わりより手前へ。単独起動のPWAならここで閉じる
  });
  armDeviceBack();
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
  initDeviceBack();
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.getAttribute('data-nav')));
  });
  // スタミナ回復表示を毎秒更新
  setInterval(updateStatusBar, 1000);
}
