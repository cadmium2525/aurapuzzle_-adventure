/* =========================================================
 * friends.js — フレンドシステム & Firestoreへのデータ保管
 * フレンドコード(= プレイヤーID)でフレンドを追加し、
 * 登録時ボーナス/毎日のあいさつでフレンドポイント(フレポ)を稼げる。
 * =======================================================*/
import { FB, firebaseEnabled, initFirebase, getUid } from './firebase.js';
import { state, saveState, onSave, entryOf } from './state.js';
import { characterById } from '../data/characters.js';
import {
  FRIEND_ADD_REWARD, FRIEND_ADD_REWARD_OTHER,
  FRIEND_GREET_REWARD, FRIEND_GREET_REWARD_OTHER, MAX_FRIENDS
} from '../data/gamedata.js';

let myUid = null;
let ready = false;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Firebase未設定/オフラインでもゲーム自体は遊べるようにする */
export function cloudEnabled() { return firebaseEnabled(); }

/**
 * 起動時に一度呼ぶ。匿名ログイン→自分のドキュメント作成/更新→
 * 保留中のフレポ受け取り→フレンド一覧の取得、を行う。
 */
export async function initCloud() {
  await initFirebase();
  if (!firebaseEnabled()) return false;
  myUid = await getUid();
  if (!myUid) return false;

  const code = state.settings.playerId;
  const rentalEntry = state.profile.rentalCharId ? entryOf(state.profile.rentalCharId) : null;
  const myRef = FB.doc(FB.db, 'users', myUid);
  const snap = await FB.getDoc(myRef);

  if (!snap.exists()) {
    await FB.setDoc(myRef, {
      name: state.profile.name, icon: state.profile.icon,
      friendCode: code, pendingFrepo: 0,
      rentalCharId: state.profile.rentalCharId || null,
      rentalStar: rentalEntry ? rentalEntry.star : null,
      rentalLv: rentalEntry ? rentalEntry.lv : null,
      rentalAwa: rentalEntry ? (rentalEntry.awa || 0) : null,
      createdAt: FB.serverTimestamp(), updatedAt: FB.serverTimestamp()
    });
    await FB.setDoc(FB.doc(FB.db, 'friendCodes', code), { uid: myUid });
  } else {
    const data = snap.data();
    // 保留中のフレポ(他プレイヤーからのボーナス)を受け取る
    const pending = data.pendingFrepo || 0;
    if (pending > 0) {
      state.frepo += pending;
      saveState();
      await FB.updateDoc(myRef, { pendingFrepo: 0 });
    }
    // プロフィール名/アイコンが未登録ならこちらの値で補完
    if (!data.friendCode) await FB.updateDoc(myRef, { friendCode: code });
  }

  await pushCloudSave();
  await refreshFriendsList();
  onSave(scheduleCloudSave);
  ready = true;
  return true;
}

/** ゲームのセーブデータ本体をクラウドへバックアップする(端末間引き継ぎ用) */
let pushTimer = null;
export function scheduleCloudSave() {
  if (!firebaseEnabled() || !myUid) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushCloudSave, 1500);
}
async function pushCloudSave() {
  if (!firebaseEnabled() || !myUid) return;
  try {
    await FB.setDoc(FB.doc(FB.db, 'users', myUid, 'save', 'state'), {
      coin: state.coin, frepo: state.frepo, orb: state.orb,
      rank: state.rank, exp: state.exp,
      stamina: state.stamina, staminaAt: state.staminaAt,
      characters: state.characters, materials: state.materials, team: state.team,
      progress: state.progress, records: state.records,
      grants: state.grants || {},        // 一度きりの付与が別端末で重複しないように運ぶ
      updatedAt: FB.serverTimestamp()
    });
    // 貸し出しキャラのレベル/開眼は後から変わるので、保存のたびに最新へ揃える
    const rental = state.profile.rentalCharId ? entryOf(state.profile.rentalCharId) : null;
    await FB.updateDoc(FB.doc(FB.db, 'users', myUid), {
      name: state.profile.name, icon: state.profile.icon,
      rentalCharId: state.profile.rentalCharId || null,
      rentalStar: rental ? rental.star : null,
      rentalLv: rental ? rental.lv : null,
      rentalAwa: rental ? (rental.awa || 0) : null,
      updatedAt: FB.serverTimestamp()
    });
  } catch (e) { console.warn('[friends] cloud save failed', e); }
}

/** プロフィール(名前/アイコン)を更新する */
export async function updateProfile(name, icon) {
  state.profile.name = name;
  state.profile.icon = icon;
  saveState();
  if (firebaseEnabled() && myUid) {
    try { await FB.updateDoc(FB.doc(FB.db, 'users', myUid), { name, icon, updatedAt: FB.serverTimestamp() }); }
    catch (e) { /* noop */ }
  }
}

/** フレンドに貸し出すキャラクターを設定する(null で貸し出し解除) */
export async function updateRentalCharacter(charId) {
  state.profile.rentalCharId = charId || null;
  // アイコンは貸し出しキャラに連動させる(フレンド側の表示は絵文字を使う)
  const base = charId ? characterById(charId) : null;
  if (base) state.profile.icon = base.portrait;
  saveState();
  if (firebaseEnabled() && myUid) {
    const e = charId ? entryOf(charId) : null;
    try {
      await FB.updateDoc(FB.doc(FB.db, 'users', myUid), {
        rentalCharId: charId || null,
        rentalStar: e ? e.star : null,
        rentalLv: e ? e.lv : null,
        rentalAwa: e ? (e.awa || 0) : null,
        updatedAt: FB.serverTimestamp()
      });
    } catch (err) { /* noop */ }
  }
}

/**
 * ダンジョン出発前に呼ぶ。各フレンドの最新の貸し出しキャラ設定を取得する。
 * (フレンド一覧のローカルキャッシュは登録時点のスナップショットなので、都度取得する)
 * @returns {Promise<Array<{uid:string,name:string,icon:string,charId:string,star:number,lv:number,awa:number}>>}
 */
export async function fetchFriendRentals() {
  if (!firebaseEnabled() || !myUid) return [];
  const results = [];
  for (const f of state.profile.friends) {
    try {
      const snap = await FB.getDoc(FB.doc(FB.db, 'users', f.uid));
      if (!snap.exists()) continue;
      const d = snap.data();
      const charId = d.rentalCharId || d.rentalMonsterId;
      if (charId) {
        results.push({
          uid: f.uid, name: d.name || f.name, icon: d.icon || f.icon,
          charId, star: d.rentalStar || null, lv: d.rentalLv || 1, awa: d.rentalAwa || 0
        });
      }
    } catch (e) { /* noop */ }
  }
  return results;
}

/** 自分のフレンド一覧をクラウドから取得し、ローカルへキャッシュする */
export async function refreshFriendsList() {
  if (!firebaseEnabled() || !myUid) return state.profile.friends;
  try {
    const snaps = await FB.getDocs(FB.collection(FB.db, 'users', myUid, 'friends'));
    const list = [];
    snaps.forEach(d => list.push({ uid: d.id, ...d.data() }));
    state.profile.friends = list;
    saveState();
  } catch (e) { console.warn('[friends] list fetch failed', e); }
  return state.profile.friends;
}

/**
 * フレンドコードでフレンドを追加する。双方にフレポボーナスを付与する。
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function addFriendByCode(rawCode) {
  if (!firebaseEnabled() || !myUid) return { ok: false, message: 'フレンド機能は現在利用できません(Firebase未設定)' };
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'フレンドコードを入力してください' };
  if (code === state.settings.playerId) return { ok: false, message: '自分のコードは登録できません' };
  if (state.profile.friends.length >= MAX_FRIENDS) return { ok: false, message: `フレンドは最大${MAX_FRIENDS}人までです` };
  if (state.profile.friends.some(f => f.uid && f.code === code)) return { ok: false, message: 'すでにフレンドです' };

  const codeSnap = await FB.getDoc(FB.doc(FB.db, 'friendCodes', code));
  if (!codeSnap.exists()) return { ok: false, message: 'そのフレンドコードは見つかりませんでした' };
  const targetUid = codeSnap.data().uid;
  if (targetUid === myUid) return { ok: false, message: '自分のコードは登録できません' };
  if (state.profile.friends.some(f => f.uid === targetUid)) return { ok: false, message: 'すでにフレンドです' };

  const targetSnap = await FB.getDoc(FB.doc(FB.db, 'users', targetUid));
  if (!targetSnap.exists()) return { ok: false, message: 'フレンドの情報が見つかりませんでした' };
  const target = targetSnap.data();

  const now = Date.now();
  await FB.setDoc(FB.doc(FB.db, 'users', myUid, 'friends', targetUid), {
    name: target.name || 'プレイヤー', icon: target.icon || '🙂', code,
    addedAt: now, lastGreetDate: ''
  });
  await FB.setDoc(FB.doc(FB.db, 'users', targetUid, 'friends', myUid), {
    name: state.profile.name, icon: state.profile.icon, code: state.settings.playerId,
    addedAt: now, lastGreetDate: ''
  });
  await FB.updateDoc(FB.doc(FB.db, 'users', targetUid), { pendingFrepo: FB.increment(FRIEND_ADD_REWARD_OTHER) });

  state.frepo += FRIEND_ADD_REWARD;
  saveState();
  await refreshFriendsList();
  return { ok: true, message: `フレンド登録しました!フレポ+${FRIEND_ADD_REWARD}` };
}

/** フレンドを削除する(片側のみ。相手側は次回一覧更新まで残るが実害はない) */
export async function removeFriend(friendUid) {
  if (!firebaseEnabled() || !myUid) return;
  try { await FB.setDoc(FB.doc(FB.db, 'users', myUid, 'friends', friendUid), { removed: true, name: '', icon: '', lastGreetDate: '' }); }
  catch (e) { /* noop */ }
  state.profile.friends = state.profile.friends.filter(f => f.uid !== friendUid);
  saveState();
}

/**
 * フレンドに毎日1回だけ「あいさつ」してフレポを稼ぐ(フレポを稼げるルート)。
 * 自分にも相手にもフレポが入る。
 */
export async function greetFriend(friendUid) {
  if (!firebaseEnabled() || !myUid) return { ok: false, message: 'フレンド機能は現在利用できません' };
  const f = state.profile.friends.find(x => x.uid === friendUid);
  if (!f) return { ok: false, message: 'フレンドが見つかりません' };
  const today = todayStr();
  if (f.lastGreetDate === today) return { ok: false, message: '今日はすでにあいさつ済みです' };

  await FB.updateDoc(FB.doc(FB.db, 'users', myUid, 'friends', friendUid), { lastGreetDate: today });
  await FB.updateDoc(FB.doc(FB.db, 'users', friendUid), { pendingFrepo: FB.increment(FRIEND_GREET_REWARD_OTHER) });

  f.lastGreetDate = today;
  state.frepo += FRIEND_GREET_REWARD;
  saveState();
  return { ok: true, message: `あいさつしました!フレポ+${FRIEND_GREET_REWARD}` };
}

/** 今日まだあいさつしていないフレンド全員にまとめてあいさつする */
export async function greetAllFriends() {
  const targets = state.profile.friends.filter(f => f.lastGreetDate !== todayStr());
  let count = 0;
  for (const f of targets) {
    const res = await greetFriend(f.uid);
    if (res.ok) count++;
  }
  return count;
}

/**
 * 指定uidのクラウドデータを丸ごと取得し、ローカル保存と同じ形に組み立てて返す。
 * ログイン直後の引き継ぎで使う。ここでは state を書き換えず、生データだけ返す。
 */
export async function fetchCloudState(uid) {
  if (!firebaseEnabled() || !uid) return null;
  const [profSnap, saveSnap, friendSnaps] = await Promise.all([
    FB.getDoc(FB.doc(FB.db, 'users', uid)),
    FB.getDoc(FB.doc(FB.db, 'users', uid, 'save', 'state')),
    FB.getDocs(FB.collection(FB.db, 'users', uid, 'friends'))
  ]);
  if (!profSnap.exists() && !saveSnap.exists()) return null;

  const prof = profSnap.exists() ? profSnap.data() : {};
  const save = saveSnap.exists() ? Object.assign({}, saveSnap.data()) : {};
  delete save.updatedAt;                   // Firestore の Timestamp は持ち帰らない

  const friends = [];
  friendSnaps.forEach(d => {
    const f = d.data();
    if (!f.removed) friends.push(Object.assign({ uid: d.id }, f));
  });

  return Object.assign({}, save, {
    // フレンドコードは端末ではなくアカウントに紐づくので、必ずクラウド側を使う
    settings: prof.friendCode ? { playerId: prof.friendCode } : {},
    profile: {
      name: prof.name || 'プレイヤー',
      icon: prof.icon || '🙂',
      rentalCharId: prof.rentalCharId || null,
      friends
    }
  });
}

export function isCloudReady() { return ready; }
