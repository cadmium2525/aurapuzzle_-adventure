/* =========================================================
 * draft.js — 下書き(push する前の編集内容)
 *
 * 編集はすぐ GitHub へ送らず、まずここに溜める。
 * リリース画面でまとめて確認してから1コミットで push する。
 *
 * 画像だけは localStorage に入らない(容量も型も合わない)ので
 * メモリに置く。なので**画像を選んだセッションのうちに push する**。
 * 再読み込みすると画像だけ外れることを、リリース画面で知らせる。
 * =======================================================*/

const KEY = 'acb_admin_draft';

const empty = () => ({ enemies: [], raids: [], characters: [], settings: {}, gifts: null, notes: '' });

/** localStorage に入る部分だけ */
let data = load();
/** path → Blob。再読み込みで消える */
const blobs = new Map();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw ? Object.assign(empty(), raw) : empty();
  } catch { return empty(); }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 容量超過など */ }
  listeners.forEach(fn => { try { fn(); } catch { /* noop */ } });
}

const listeners = [];
/** 下書きが変わったら呼ばれる(ヘッダーのバッジ更新用) */
export function onChange(fn) { listeners.push(fn); }

export function draft() { return data; }

/** id が同じものは差し替え、無ければ足す */
export function upsert(kind, item) {
  const list = data[kind];
  const i = list.findIndex(x => String(x.id) === String(item.id));
  if (i >= 0) list[i] = item; else list.push(item);
  persist();
}

export function remove(kind, id) {
  data[kind] = data[kind].filter(x => String(x.id) !== String(id));
  persist();
}

export function find(kind, id) {
  return data[kind].find(x => String(x.id) === String(id)) || null;
}

/** 画像を1枚預かる。path はリポジトリ上の置き場所 */
export function putBlob(path, blob) {
  blobs.set(path, blob);
  persist();
}
export function getBlob(path) { return blobs.get(path) || null; }
export function dropBlob(path) { blobs.delete(path); persist(); }
export function blobEntries() { return Array.from(blobs.entries()); }

/** ガチャのピックアップなど、1つしか無い設定 */
export function settings() { return data.settings || {}; }
export function setSetting(key, value) {
  if (!data.settings) data.settings = {};
  if (value === '' || value == null) delete data.settings[key];
  else data.settings[key] = value;
  persist();
}

/** 下書きに何か入っているか(ヘッダーのバッジ) */
export function pendingCount() {
  return data.enemies.length + data.raids.length + data.characters.length
    + blobs.size + Object.keys(data.settings || {}).length + (data.gifts ? 1 : 0);
}

/** push が終わったら空にする */
export function clearAll() {
  data = empty();
  blobs.clear();
  persist();
}

/** 下書きの中身をファイルに書き出す(バックアップ用。画像は含まない) */
export function exportJson() {
  return JSON.stringify(data, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  data = Object.assign(empty(), parsed);
  persist();
}
