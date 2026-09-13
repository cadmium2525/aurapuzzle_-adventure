/* =========================================================
 * audio.js — ユーザー操作後に開始するBGM管理
 * =======================================================*/
import { state } from './state.js';

const SOURCES = {
  field: './assets/Welcome_to_the_Puzzle.mp3',
  battle: './assets/Circuit_Breaker.mp3'
};

let players = null;
let desiredScene = 'field';
let activeScene = null;
let unlocked = false;
let initialized = false;
let volumeLevel = null;

function currentVolume() {
  return volumeLevel ?? Math.max(0, Math.min(100, Number(state.settings.bgm) || 0)) / 100;
}

function ensurePlayers() {
  if (players) return players;
  players = Object.fromEntries(Object.entries(SOURCES).map(([scene, src]) => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = currentVolume();
    return [scene, audio];
  }));
  return players;
}

function syncBgm(restart = false) {
  if (!unlocked || document.hidden) return;
  const all = ensurePlayers();
  Object.entries(all).forEach(([scene, audio]) => {
    if (scene !== desiredScene) audio.pause();
  });
  const next = all[desiredScene];
  if (!next) return;
  next.volume = currentVolume();
  if (next.volume <= 0) { next.pause(); return; }
  if (restart && activeScene !== desiredScene) next.currentTime = 0;
  activeScene = desiredScene;
  next.play().catch(() => {});
}

/** ローディング画面が進捗として待てる、2曲の読み込みPromise。 */
export function preloadBgm() {
  return Object.values(ensurePlayers()).map(audio => new Promise(resolve => {
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) { resolve(); return; }
    const done = () => { cleanup(); resolve(); };
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener('loadeddata', done);
      audio.removeEventListener('error', done);
    };
    const timer = setTimeout(done, 10000);
    audio.addEventListener('loadeddata', done, { once: true });
    audio.addEventListener('error', done, { once: true });
    audio.load();
  }));
}

/** TAP TO START のクリックハンドラ内から同期的に呼ぶ。 */
export function startBgm() {
  unlocked = true;
  syncBgm(true);
}

export function setBgmScene(scene) {
  desiredScene = scene === 'battle' ? 'battle' : 'field';
  syncBgm(true);
}

export function setBgmVolume(value) {
  const volume = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
  volumeLevel = volume;
  Object.values(ensurePlayers()).forEach(audio => { audio.volume = volume; });
  if (volume > 0) syncBgm();
  else Object.values(players).forEach(audio => audio.pause());
}

export function initAudio() {
  ensurePlayers();
  if (initialized) return;
  initialized = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Object.values(ensurePlayers()).forEach(audio => audio.pause());
    else syncBgm();
  });
}
