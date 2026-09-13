/* =========================================================
 * gifts.js — プレゼントボックス
 *
 * 受け取りを1か所にまとめる箱。中身は次の3種類。
 *   1. ログインボーナス(その日はじめての起動で1つ入る)
 *   2. フレンド由来のフレポ(あいさつされたぶん / 貸し出しキャラが使われたぶん)
 *   3. 運営からのプレゼント(Firestore の gifts コレクション)
 *
 * 「配る」と「受け取る」を分けているのが要点で、起動時に所持数を直接
 * 増やさない。受け取りはプレイヤーの操作で行われるので、増えたことに
 * 気づかないまま進む事故が起きない。
 *
 * 運営プレゼントは Cloud Functions を使わずに配る必要があるため、
 * 全員が読めるコレクションを置き、受け取り済みかどうかは端末側の
 * giftLog(クラウドのセーブにも乗る)で管理している。
 * =======================================================*/
import { state, saveState } from './state.js';
import { FB, firebaseEnabled } from './firebase.js';
import { loginBonusFor } from '../data/gamedata.js';

/** 運営プレゼントの取得件数の上限(無料枠の読み取り数を抑える) */
const NOTICE_LIMIT = 20;

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** その日付の前日を YYYY-MM-DD で返す */
function prevDayStr(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

let seq = 0;
const newId = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ===================== 箱の中身 ===================== */
export function giftList() {
  if (!Array.isArray(state.gifts)) state.gifts = [];
  return state.gifts;
}
export function giftCount() { return giftList().length; }

/**
 * プレゼントを1つ入れる。
 * @param {{title:string, note?:string, coin?:number, orb?:number, frepo?:number, stamina?:number, key?:string}} gift
 *        key を渡すと、同じ key のものが既に入っているときは重ねない。
 */
export function addGift(gift) {
  const list = giftList();
  if (gift.key && list.some(g => g.key === gift.key)) return null;
  const g = Object.assign({ id: newId(), at: Date.now() }, gift);
  list.push(g);
  saveState();
  return g;
}

/** 受け取り内容を所持数へ反映する */
function applyGift(g) {
  if (g.coin) state.coin += g.coin;
  if (g.orb) state.orb += g.orb;
  if (g.frepo) state.frepo += g.frepo;
  if (g.stamina) state.stamina += g.stamina;   // 上限超過はそのまま保持される
}

/** 受け取り内容を「💰300 💎2」のような表示にする */
export function giftRewardText(g) {
  const parts = [];
  if (g.coin) parts.push(`💰${g.coin}`);
  if (g.frepo) parts.push(`🎗️${g.frepo}`);
  if (g.orb) parts.push(`💎${g.orb}`);
  if (g.stamina) parts.push(`⚡${g.stamina}`);
  return parts.join(' ');
}

/** 1つ受け取る */
export function claimGift(id) {
  const list = giftList();
  const i = list.findIndex(g => g.id === id);
  if (i < 0) return null;
  const [g] = list.splice(i, 1);
  applyGift(g);
  saveState();
  return g;
}

/** すべて受け取る。合計を返す */
export function claimAllGifts() {
  const list = giftList();
  if (!list.length) return null;
  const total = { count: list.length, coin: 0, orb: 0, frepo: 0, stamina: 0 };
  list.forEach(g => {
    applyGift(g);
    ['coin', 'orb', 'frepo', 'stamina'].forEach(k => { total[k] += g[k] || 0; });
  });
  state.gifts = [];
  saveState();
  return total;
}

/* ===================== ログインボーナス ===================== */
/**
 * その日はじめての起動なら、ログインボーナスを箱へ入れる。
 * 前日にログインしていれば連続日数が伸び、空いていれば1日目へ戻る。
 * @returns {{streak:number, reward:object}|null} 配ったときだけ返す
 */
export function checkLoginBonus() {
  if (!state.login) state.login = { date: '', streak: 0 };
  const today = todayStr();
  if (state.login.date === today) return null;

  const continued = state.login.date && state.login.date === prevDayStr(today);
  const streak = continued ? (state.login.streak || 0) + 1 : 1;
  const reward = loginBonusFor(streak);

  state.login = { date: today, streak };
  addGift(Object.assign({
    title: `ログインボーナス ${streak}日目`,
    note: continued ? `${streak}日連続ログイン中!` : 'おかえりなさい!'
  }, reward));
  saveState();
  return { streak, reward };
}

/** 表示用の連続ログイン日数 */
export function loginStreak() { return (state.login && state.login.streak) || 0; }

/* ===================== 運営からのプレゼント ===================== */
/**
 * Firestore の gifts コレクションを読み、まだ受け取っていないものを箱へ入れる。
 * ドキュメントは管理者が Firebase コンソールから直接作る想定で、形式は
 *   { title, note, coin, orb, frepo, stamina, from, to }  (from/to は YYYY-MM-DD)
 * 期限切れ(to が過去)のものは配らない。
 * @returns {Promise<number>} 新しく入れた件数
 */
export async function fetchOperatorGifts() {
  if (!firebaseEnabled()) return 0;
  if (!state.giftLog) state.giftLog = {};
  let added = 0;
  try {
    const snaps = await FB.getDocs(FB.query(FB.collection(FB.db, 'gifts'), FB.limit(NOTICE_LIMIT)));
    const today = todayStr();
    snaps.forEach(d => {
      if (state.giftLog[d.id]) return;               // 受け取り済み(または配布済み)
      const v = d.data() || {};
      if (v.from && today < v.from) return;          // 配布開始前
      if (v.to && today > v.to) return;              // 期限切れ
      state.giftLog[d.id] = today;
      addGift({
        title: v.title || '運営からのプレゼント',
        note: v.note || '',
        coin: v.coin || 0, orb: v.orb || 0,
        frepo: v.frepo || 0, stamina: v.stamina || 0
      });
      added++;
    });
    if (added) saveState();
  } catch (e) { /* 読めなくてもゲーム進行には影響させない */ }
  return added;
}
