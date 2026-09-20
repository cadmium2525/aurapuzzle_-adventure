/* =========================================================
 * ui.js — 汎用UIユーティリティ
 * =======================================================*/
import { CHAR_ATLAS, CHAR_ATLAS_COLUMNS, CHAR_ATLAS_ROWS } from '../data/char-atlas.js';
import { eventMaterials } from '../data/availability.js';

export const $ = id => document.getElementById(id);

export function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }

export function uid() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'AC-' + part() + part();
}

export function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

/** mm:ss 形式 */
export function formatMMSS(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * イラストの差し込み。
 * 画像が用意されていればそれを使い、読み込めなければ絵文字に戻す。
 * (assets/chars/ に画像を置くまでは絵文字のまま動く)
 * 画面とバトルの両方から使うので core に置いている。
 */
export function artImg(src, emoji, cls) {
  if (!src) return `<span class="${cls}-emoji">${emoji}</span>`;
  return `<img class="${cls}-img" src="${src}" alt="" loading="lazy"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}-emoji',textContent:'${emoji}'}))">`;
}

/* キャラクターアトラスの拡大率。生成物に追従させたいのでCSSには直書きせず、
   最初にアイコンを描くときだけ流し込む(テストはDOMなしで読み込むので遅延させる)。 */
let atlasSized = false;
function ensureAtlasSize() {
  if (atlasSized || typeof document === 'undefined') return;
  atlasSized = true;
  document.documentElement.style.setProperty(
    '--char-atlas-size', `${CHAR_ATLAS_COLUMNS * 100}% ${CHAR_ATLAS_ROWS * 100}%`);
}

/**
 * キャラクターの丸アイコン。
 * 一覧では数十枚を一度に並べるので、アトラスに焼いてあるものは
 * 1枚絵の切り出しで描く(リクエストが1回で済む)。
 * アトラスに無いイラストや絵文字だけのキャラは artImg() に任せる。
 */
export function charIcon(src, emoji, cls) {
  const cell = src ? CHAR_ATLAS[src] : null;
  if (!cell) return artImg(src, emoji, cls);
  ensureAtlasSize();
  const pos = (i, n) => (n > 1 ? (i / (n - 1)) * 100 : 0).toFixed(3);
  return `<span class="${cls}-img char-atlas" aria-hidden="true"
    style="--cp:${pos(cell[0], CHAR_ATLAS_COLUMNS)}% ${pos(cell[1], CHAR_ATLAS_ROWS)}%"></span>`;
}

/** 共有アイテムアトラス内のアイコン。id は game data 側の固定値を渡す。 */
export function itemIcon(id, cls = '') {
  const material = eventMaterials().find(m=>m.id===id);
  if (material) return material.icon
    ? `<img class="item-icon ${cls}" src="${material.icon}" alt="${material.name}" style="object-fit:contain;background:none">`
    : `<span class="item-icon ${cls}" style="background:none">${material.emoji}</span>`;
  return `<span class="item-icon i-${id}${cls ? ` ${cls}` : ''}" aria-hidden="true"></span>`;
}

let toastTimer = null;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}
