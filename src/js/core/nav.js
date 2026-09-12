/* =========================================================
 * nav.js — 画面遷移とトップバー
 * =======================================================*/
import { $, formatMMSS, artImg } from './ui.js';
import { state, tickStamina, maxStamina, staminaNextInMs, resolveOwned } from './state.js';
import { expToNextRank } from '../data/gamedata.js';

const TITLES = {
  home: 'ホーム', dungeon: 'ダンジョン', battle: 'バトル', event: 'イベント',
  character: 'キャラクター', gacha: 'ガチャ', shop: 'ショップ',
  mypage: 'マイページ', friends: 'フレンド', guide: 'あそびかた'
};

const renderers = {};
/** 画面表示時に呼ぶ描画関数を登録する */
export function registerScreen(name, fn) { renderers[name] = fn; }

export let currentScreen = 'home';
const navStack = [];

export function showScreen(name, push) {
  if (push !== false && currentScreen !== name) navStack.push(currentScreen);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $('screen-' + name);
  if (!el) return;
  el.classList.add('active');
  $('screenTitle').textContent = TITLES[name] || '';
  $('backBtn').classList.toggle('hidden', name === 'home' || name === 'battle');
  $('statusBar').classList.toggle('hidden', name === 'battle');
  document.body.classList.toggle('in-battle', name === 'battle');
  currentScreen = name;
  if (renderers[name]) renderers[name]();
  updateStatusBar();
  // 画面切り替え時は先頭へ戻す
  window.scrollTo({ top: 0 });
}

export function goBack() {
  const prev = navStack.pop() || 'home';
  showScreen(prev, false);
}

/* ===================== トップバー ===================== */
/**
 * プロフィールアイコンを描く。
 * アイコンはフレンドへの貸し出しに設定したキャラクターのもの。
 * 未設定・イラスト無しのときは絵文字にフォールバックする。
 */
function renderProfileIcon() {
  const el = $('statusProfileIcon');
  if (!el) return;
  const id = state.profile.rentalCharId;
  const ch = id ? resolveOwned(id) : null;
  el.innerHTML = ch
    ? artImg(ch.art && ch.art.icon, ch.portrait, 'pi')
    : '<span class="pi-emoji">🙂</span>';
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
  const expEl = $('rankExpFill');
  if (expEl) expEl.style.width = (state.exp / expToNextRank(state.rank) * 100) + '%';
}

export function initNav() {
  $('backBtn').addEventListener('click', goBack);
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.getAttribute('data-nav')));
  });
  // スタミナ回復表示を毎秒更新
  setInterval(updateStatusBar, 1000);
}
