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

let toastTimer = null;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}
