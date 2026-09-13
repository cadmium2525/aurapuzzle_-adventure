/* Ambient Web Audio respects the iPhone Ring/Silent switch. */
import { state } from './state.js';
const SOURCES = { field: './assets/Welcome_to_the_Puzzle.mp3', battle: './assets/Circuit_Breaker.mp3' };
const SCENE_GAIN = { field: 1, battle: 1 / 3 };
let context, gain, source;
let desiredScene = 'field', unlocked = false, initialized = false, volumeLevel = null;
let offset = 0, startedAt = 0;
const buffers = new Map(), pending = new Map();

function ambientSession() {
  // WebKit maps transient to Ambient; older Safari defaults Web Audio to ambient.
  try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch {}
}

function ensureContext() {
  if (context) return context;
  ambientSession();
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  context = new Context();
  gain = context.createGain();
  gain.connect(context.destination);
  return context;
}

function volume() {
  return volumeLevel ?? Math.max(0, Math.min(100, Number(state.settings.bgm) || 0)) / 100;
}

function pause() {
  if (!source) return;
  offset += context.currentTime - startedAt;
  source.stop();
  source.disconnect();
  source = null;
}

function syncBgm() {
  if (!unlocked || document.hidden || !ensureContext()) return;
  gain.gain.value = volume() * SCENE_GAIN[desiredScene];
  if (volume() === 0) { pause(); return; }
  if (!buffers.has(desiredScene)) { loadTrack(desiredScene).catch(() => {}); return; }
  if (source) return;
  const buffer = buffers.get(desiredScene);
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  startedAt = context.currentTime;
  source.start(0, offset % buffer.duration);
}

function loadTrack(scene) {
  if (buffers.has(scene)) return Promise.resolve();
  if (pending.has(scene)) return pending.get(scene);
  const task = (async () => {
    if (!ensureContext()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(SOURCES[scene], { signal: controller.signal });
      if (!response.ok) throw new Error('BGM load failed: ' + response.status);
      const bytes = await response.arrayBuffer();
      buffers.set(scene, await context.decodeAudioData(bytes));
    } finally { clearTimeout(timer); }
  })().finally(() => pending.delete(scene));
  pending.set(scene, task);
  task.then(() => { if (scene === desiredScene) syncBgm(); }, () => {});
  return task;
}

export function preloadBgm() {
  return Object.keys(SOURCES).map(scene => loadTrack(scene).catch(() => {}));
}

export function startBgm() {
  unlocked = true;
  ambientSession();
  if (ensureContext()) context.resume().then(syncBgm).catch(() => {});
  syncBgm();
}

export function setBgmScene(scene) {
  const next = scene === 'battle' ? 'battle' : 'field';
  if (next !== desiredScene) { pause(); offset = 0; }
  desiredScene = next;
  syncBgm();
}

export function setBgmVolume(value) {
  volumeLevel = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
  syncBgm();
}

export function initAudio() {
  if (initialized) return;
  initialized = true;
  ensureContext();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      if (context) context.suspend().catch(() => {});
    } else if (unlocked) {
      ambientSession();
      if (context) context.resume().then(syncBgm).catch(() => {});
    }
  });
}
