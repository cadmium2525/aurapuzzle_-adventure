/* =========================================================
 * nav.js — 画面遷移とトップバー
 * =======================================================*/
import { $, formatMMSS } from './ui.js';
import { state, tickStamina, maxStamina, staminaNextInMs } from './state.js';
import { expToNextRank } from '../data/gamedata.js';

const TITLES = {
  home: 'ホーム', dungeon: 'ダンジョン', battle: 'バトル', event: 'イベント',
  monster: 'モンスター', gacha: 'ガチャ', shop: 'ショップ', settings: '設定'
};

const renderers = {};
/** 画面表示時に呼ぶ描画関数を登録する */
export function registerScreen(name, fn) { renderers[name] = fn; }

export let currentScreen = 'home';
const navStack = [];

export function showScreen(name, push) {
  if (push !== false && currentScreen !== name) navStack.push(currentScreen);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  $('screenTitle').textContent = TITLES[name] || '';
  $('backBtn').classList.toggle('hidden', name === 'home' || name === 'battle');
  $('statusBar').classList.toggle('hidden', name === 'battle');
  document.body.classList.toggle('in-battle', name === 'battle');
  currentScreen = name;
  if (renderers[name]) renderers[name]();
  updateStatusBar();
}

export function goBack() {
  const prev = navStack.pop() || 'home';
  showScreen(prev, false);
}

/* ===================== トップバー ===================== */
export function updateStatusBar() {
  tickStamina();
  const max = maxStamina();
  $('curStamina').textContent = `${state.stamina}/${max}`;
  const next = staminaNextInMs();
  $('staminaTimer').textContent = next > 0 ? formatMMSS(next) : 'MAX';
  $('curRank').textContent = state.rank;
  $('curCoin').textContent = state.coin;
  $('curFrepo').textContent = state.frepo;
  $('curOrb').textContent = state.orb;
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
