/* =========================================================
 * storage.js — localStorage ラッパー(不可時はメモリへフォールバック)
 * =======================================================*/
const mem = {};
let ok = true;
try {
  localStorage.setItem('__t__', '1');
  localStorage.removeItem('__t__');
} catch (e) { ok = false; }

export const Store = {
  get(k, def) {
    try {
      if (ok) {
        const v = localStorage.getItem(k);
        return v !== null ? JSON.parse(v) : def;
      }
    } catch (e) { /* noop */ }
    return mem[k] !== undefined ? mem[k] : def;
  },
  set(k, v) {
    try {
      if (ok) { localStorage.setItem(k, JSON.stringify(v)); return; }
    } catch (e) { /* noop */ }
    mem[k] = v;
  }
};
