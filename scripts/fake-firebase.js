/* テスト用の偽 Firebase。メモリ上の Firestore を持ち、
   window.__fb で中身の確認と失敗の注入ができる。 */
const store = new Map();                       // "a/b/c" -> data
const fail = { set: new Set(), get: new Set() };
const key = parts => parts.join('/');
const clone = v => JSON.parse(JSON.stringify(v));
const DELETE = { __delete: true };

function maybeFail(kind, path) {
  for (const p of fail[kind]) if (path.startsWith(p)) {
    const e = new Error('injected'); e.code = 'unavailable'; throw e;
  }
}
export const FB = {
  ready: true, db: {},
  doc: (_db, ...p) => ({ path: key(p) }),
  collection: (_db, ...p) => ({ path: key(p), isCol: true }),
  getDoc: async ref => { maybeFail('get', ref.path);
    const d = store.get(ref.path);
    return { exists: () => d !== undefined, data: () => clone(d || {}) }; },
  setDoc: async (ref, data) => { maybeFail('set', ref.path); store.set(ref.path, clone(data)); },
  updateDoc: async (ref, patch) => { maybeFail('set', ref.path);
    const cur = store.get(ref.path) || {};
    for (const [k, v] of Object.entries(patch)) {
      if (v && v.__delete) delete cur[k]; else cur[k] = v;
    }
    store.set(ref.path, cur); },
  deleteField: () => DELETE,
  getDocs: async ref => {
    maybeFail('get', ref.path);
    const rows = [];
    for (const [k, v] of store.entries()) {
      if (!k.startsWith(ref.path + '/')) continue;
      const rest = k.slice(ref.path.length + 1);
      if (rest.includes('/')) continue;
      rows.push({ id: rest, data: () => clone(v) });
    }
    return { size: rows.length, forEach: fn => rows.forEach(fn) };
  },
  query: (c) => c, limit: () => null,
  serverTimestamp: () => Date.now(), increment: n => n, runTransaction: null
};
export const AUTH = { ready: true, auth: {}, user: { uid: 'ME', isAnonymous: true } };
export function initFirebase() { return Promise.resolve(true); }
export function firebaseEnabled() { return true; }
export function firebaseConfigured() { return true; }
export async function getUid() { return 'ME'; }
export function currentUid() { return 'ME'; }
export function isAnonymous() { return true; }
export function currentEmail() { return null; }

window.__fb = {
  store, fail,
  dump: () => Object.fromEntries(store),
  seed: (path, data) => store.set(path, data),
  failSet: p => fail.set.add(p),
  failGet: p => fail.get.add(p),
  clearFail: () => { fail.set.clear(); fail.get.clear(); }
};
