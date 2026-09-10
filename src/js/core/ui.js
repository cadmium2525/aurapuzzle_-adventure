/* =========================================================
 * ui.js — 汎用UIユーティリティ
 * =======================================================*/
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

let toastTimer = null;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}
