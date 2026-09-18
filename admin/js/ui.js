/* =========================================================
 * ui.js — 画面づくりの小道具
 * =======================================================*/

export const $ = id => document.getElementById(id);

/** HTML に混ぜても安全な文字列にする(名前や台詞に < が来ても壊れない) */
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer = null;
export function toast(message, kind = '') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/** 画面いっぱいのモーダル。閉じたら resolve する */
export function modal(title, bodyHTML, options = {}) {
  return new Promise(resolve => {
    const host = $('modalHost');
    host.innerHTML = `
      <div class="modal-back">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h2>${esc(title)}</h2>
            <button class="icon-btn" data-close aria-label="閉じる">✕</button>
          </div>
          <div class="modal-body">${bodyHTML}</div>
          <div class="modal-foot">
            ${options.okLabel ? `<button class="btn primary" data-ok>${esc(options.okLabel)}</button>` : ''}
            <button class="btn" data-close>${esc(options.cancelLabel || '閉じる')}</button>
          </div>
        </div>
      </div>`;
    host.hidden = false;
    const done = value => { host.hidden = true; host.innerHTML = ''; resolve(value); };
    host.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => done(null)));
    const ok = host.querySelector('[data-ok]');
    if (ok) {
      ok.addEventListener('click', () => {
        const form = host.querySelector('.modal-body');
        done(options.collect ? options.collect(form) : true);
      });
    }
    host.querySelector('.modal-back').addEventListener('click', e => {
      if (e.target.classList.contains('modal-back')) done(null);
    });
    if (options.onOpen) options.onOpen(host.querySelector('.modal-body'), done);
  });
}

/** はい／いいえ */
export async function confirmAsk(title, message, okLabel = '実行する') {
  const answer = await modal(title, `<p class="lead">${esc(message)}</p>`, { okLabel });
  return answer === true;
}

/** 入力欄1つぶん */
export function field(label, name, value, options = {}) {
  const type = options.type || 'text';
  const hint = options.hint ? `<span class="hint">${esc(options.hint)}</span>` : '';
  if (type === 'select') {
    const opts = options.options.map(o => {
      const [v, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(text)}</option>`;
    }).join('');
    return `<label class="field"><span>${esc(label)}${hint}</span>
      <select name="${esc(name)}">${opts}</select></label>`;
  }
  if (type === 'textarea') {
    return `<label class="field"><span>${esc(label)}${hint}</span>
      <textarea name="${esc(name)}" rows="${options.rows || 3}"
        placeholder="${esc(options.placeholder || '')}">${esc(value)}</textarea></label>`;
  }
  const extra = [
    options.min != null ? `min="${options.min}"` : '',
    options.max != null ? `max="${options.max}"` : '',
    options.step != null ? `step="${options.step}"` : ''
  ].join(' ');
  return `<label class="field"><span>${esc(label)}${hint}</span>
    <input type="${type}" name="${esc(name)}" value="${esc(value)}" ${extra}
      placeholder="${esc(options.placeholder || '')}"></label>`;
}

/** フォームの値をまとめて取る。数値の欄は数値にして返す */
export function readForm(root, numericKeys = []) {
  const out = {};
  root.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
    if (el.type === 'checkbox') { out[el.name] = el.checked; return; }
    const raw = el.value;
    out[el.name] = numericKeys.includes(el.name) || el.type === 'number'
      ? (raw === '' ? null : Number(raw))
      : raw;
  });
  return out;
}

/** 整数に丸めて範囲に収める。入力ミスでゲームが壊れないようにする */
export function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** 見出し＋中身のカード */
export function card(title, bodyHTML, actionsHTML = '') {
  return `<section class="card">
    <div class="card-head"><h2>${esc(title)}</h2><div class="card-actions">${actionsHTML}</div></div>
    ${bodyHTML}
  </section>`;
}

/** 空の一覧に出す案内 */
export function emptyNote(text) {
  return `<p class="empty">${esc(text)}</p>`;
}
