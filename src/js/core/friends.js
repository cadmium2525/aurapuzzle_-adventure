/* =========================================================
 * friends.js — フレンドシステム & Firestoreへのデータ保管
 * フレンドコード(= プレイヤーID)でフレンドを追加し、
 * 毎日のあいさつ/貸し出しキャラの使用でフレンドポイント(フレポ)を稼げる。
 * 受け取りはプレゼントボックス経由。
 * =======================================================*/
import { FB, firebaseEnabled, initFirebase, getUid } from './firebase.js';
import { state, saveState, onSave, entryOf } from './state.js';
import { characterById } from '../data/characters.js';
import { addGift } from './gifts.js';
import {
  FRIEND_GREET_REWARD, FRIEND_GREET_REWARD_OTHER,
  FRIEND_RENTAL_REWARD, MAX_FRIENDS
} from '../data/gamedata.js';

let myUid = null;
let ready = false;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * クラウド側の失敗を、画面に出せる文に変える。
 *
 * **黙って失敗させないこと。** フレンド登録は「押したのに何も起きない」が
 * いちばん困る。利用者からは「登録したのに居ない」「消えた」に見えるが、
 * 実際には通信や権限で弾かれているだけ、ということがある。
 */
function cloudErrorMessage(e, what) {
  const code = (e && e.code) || '';
  if (code === 'permission-denied') return `${what}に失敗しました(権限がありません)`;
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted') {
    return `${what}に失敗しました(通信できていないようです。電波の良いところでもう一度お試しください)`;
  }
  if (code === 'resource-exhausted') return `${what}に失敗しました(しばらく待ってからお試しください)`;
  return `${what}に失敗しました(${code || (e && e.message) || '原因不明'})`;
}

/** 相手の一覧へ「自分」を書き込む。登録時と、取りこぼしのやり直しで使う */
function writeBackLink(targetUid, addedAt) {
  return FB.setDoc(FB.doc(FB.db, 'users', targetUid, 'friends', myUid), {
    name: state.profile.name, icon: state.profile.icon, code: state.settings.playerId,
    addedAt: addedAt || Date.now(), lastGreetDate: ''
  });
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
      rentalUseCount: 0, rentalRewardedCount: 0, lastRentalRewardDate: '',
      rentalCharId: state.profile.rentalCharId || null,
      rentalStar: rentalEntry ? rentalEntry.star : null,
      rentalLv: rentalEntry ? rentalEntry.lv : null,
      rentalAwa: rentalEntry ? (rentalEntry.awa || 0) : null,
      rank: state.rank,
      createdAt: FB.serverTimestamp(), lastLoginAt: FB.serverTimestamp(), updatedAt: FB.serverTimestamp()
    });
    await FB.setDoc(FB.doc(FB.db, 'friendCodes', code), { uid: myUid });
  } else {
    const data = snap.data();
    // 保留中のフレポ(フレンドからのあいさつ)はプレゼントボックスへ入れる
    const pending = data.pendingFrepo || 0;
    if (pending > 0) {
      addGift({ title: 'フレンドからのあいさつ', note: 'あいさつのお礼です', frepo: pending });
      await FB.updateDoc(myRef, { pendingFrepo: 0 });
    }
    // プロフィール名/アイコンが未登録ならこちらの値で補完
    if (!data.friendCode) await FB.updateDoc(myRef, { friendCode: code });
    // 自分のキャラが使われたぶんを翌日まとめて受け取る
    lastRentalClaim = await claimRentalReward(myRef, data);
    await FB.updateDoc(myRef, { rank: state.rank, lastLoginAt: FB.serverTimestamp() });
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
      version: state.version,
      coin: state.coin, frepo: state.frepo, orb: state.orb,
      rank: state.rank, exp: state.exp,
      stamina: state.stamina, staminaAt: state.staminaAt,
      characters: state.characters, materials: state.materials,
      teams: state.teams, teamIndex: state.teamIndex, lastTeam: state.lastTeam,
      progress: state.progress, records: state.records,
      grants: state.grants || {},        // 一度きりの付与が別端末で重複しないように運ぶ
      gifts: state.gifts || [],          // 未受け取りのプレゼント
      giftLog: state.giftLog || {},      // 受け取り済みの運営プレゼント
      login: state.login || {},          // ログインボーナスの連続日数
      shopLog: state.shopLog || {},      // 1日の購入上限を端末をまたいでも守る
      shopTotal: state.shopTotal || {},  // 買い切りが端末を変えると復活するのを防ぐ
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
      rank: state.rank,
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
    /* 読めたのに1件も無く、手元には居るときは、この一覧を信じない。
       削除しても removed の印が残る作りなので、本当に0件になることはない。
       0件で返ってくるのは別の uid を見ているとき(匿名ログインが作り直されたなど)で、
       そのまま上書きするとフレンドが全員消えてしまう。 */
    if (snaps.size === 0 && state.profile.friends.length) {
      console.warn('[friends] cloud list empty but local cache is not; keeping cache');
      return state.profile.friends;
    }
    const list = [];
    snaps.forEach(d => {
      const data = d.data();
      if (!data.removed) list.push({ uid: d.id, ...data });
    });
    /* 登録のとき相手側へ書けなかったぶんをやり直す。
       印は自分の側の書類に残してあるので、追加の読み取りは要らない。 */
    await Promise.all(list.filter(f => f.linkPending).map(async f => {
      try {
        await writeBackLink(f.uid, f.addedAt);
        await FB.updateDoc(FB.doc(FB.db, 'users', myUid, 'friends', f.uid),
          { linkPending: FB.deleteField() });
        delete f.linkPending;
      } catch (e) { /* 次の更新でまたやり直す */ }
    }));
    // サブコレクションは登録時の情報なので、プロフィール本体から現在値を補う。
    await Promise.all(list.map(async f => {
      try {
        const snap = await FB.getDoc(FB.doc(FB.db, 'users', f.uid));
        if (!snap.exists()) return;
        const profile = snap.data();
        f.name = profile.name || f.name;
        f.icon = profile.icon || f.icon;
        // 表示用のアイコンは貸し出しキャラのイラスト。設定を変えたら次の更新で追従する
        f.rentalCharId = profile.rentalCharId || profile.rentalMonsterId || null;
        f.rentalStar = profile.rentalStar || null;
        f.rentalLv = profile.rentalLv || 1;
        f.rentalAwa = profile.rentalAwa || 0;
        f.rank = Number(profile.rank) || Number(f.rank) || null;
        f.lastLoginAt = profile.lastLoginAt || profile.updatedAt || f.lastLoginAt || null;
        if (!f.rank) {
          const saveSnap = await FB.getDoc(FB.doc(FB.db, 'users', f.uid, 'save', 'state'));
          if (saveSnap.exists()) f.rank = Number(saveSnap.data().rank) || null;
        }
      } catch (e) { /* キャッシュ済み情報で表示を続ける */ }
    }));
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

  let target, targetUid;
  try {
    const codeSnap = await FB.getDoc(FB.doc(FB.db, 'friendCodes', code));
    if (!codeSnap.exists()) return { ok: false, message: 'そのフレンドコードは見つかりませんでした' };
    targetUid = codeSnap.data().uid;
    if (!targetUid) return { ok: false, message: 'そのフレンドコードは登録が壊れています' };
    if (targetUid === myUid) return { ok: false, message: '自分のコードは登録できません' };
    if (state.profile.friends.some(f => f.uid === targetUid)) return { ok: false, message: 'すでにフレンドです' };

    const targetSnap = await FB.getDoc(FB.doc(FB.db, 'users', targetUid));
    if (!targetSnap.exists()) return { ok: false, message: 'フレンドの情報が見つかりませんでした' };
    target = targetSnap.data();
  } catch (e) {
    console.warn('[friends] lookup failed', e);
    return { ok: false, message: cloudErrorMessage(e, 'フレンドの確認') };
  }
  return linkFriend(targetUid, {
    name: target.name || 'プレイヤー', icon: target.icon || '🙂', code
  });
}

/**
 * 双方の一覧に印を付けて、フレンド関係を作る。
 *
 * **自分の一覧への書き込みだけが成否を決める。** 相手の一覧へ書けなかった
 * ときは linkPending の印だけ残して成功として扱い、次の一覧更新でやり直す。
 * ここで丸ごと失敗にすると、相手側が一時的に書けなかっただけで
 * 「登録したのに居ない」状態になってしまう。
 */
async function linkFriend(targetUid, info) {
  const now = Date.now();
  try {
    await FB.setDoc(FB.doc(FB.db, 'users', myUid, 'friends', targetUid), {
      name: info.name, icon: info.icon, code: info.code, addedAt: now, lastGreetDate: ''
    });
  } catch (e) {
    console.warn('[friends] add failed', e);
    return { ok: false, message: cloudErrorMessage(e, 'フレンド登録') };
  }
  let pending = false;
  try {
    await writeBackLink(targetUid, now);
  } catch (e) {
    pending = true;
    console.warn('[friends] back link failed; will retry', e);
    try {
      await FB.updateDoc(FB.doc(FB.db, 'users', myUid, 'friends', targetUid), { linkPending: true });
    } catch (err) { /* 印が残せなくても、自分の一覧には入っている */ }
  }
  try { await refreshFriendsList(); } catch (e) { /* 一覧は次に開いたときで良い */ }
  return { ok: true, message: pending
    ? `${info.name}をフレンドに登録しました(相手側への反映は次回の更新でやり直します)`
    : `${info.name}をフレンドに登録しました` };
}

/**
 * uid を直接指定してフレンド登録する。
 * ダンジョンで他のプレイヤーのキャラを借りたあとの導線で使う。
 */
export async function addFriendByUid(targetUid, fallbackName) {
  if (!firebaseEnabled() || !myUid) return { ok: false, message: 'フレンド機能は現在利用できません' };
  if (!targetUid || targetUid === myUid) return { ok: false, message: '自分は登録できません' };
  if (state.profile.friends.length >= MAX_FRIENDS) return { ok: false, message: `フレンドは最大${MAX_FRIENDS}人までです` };
  if (state.profile.friends.some(f => f.uid === targetUid)) return { ok: false, message: 'すでにフレンドです' };

  let target;
  try {
    const snap = await FB.getDoc(FB.doc(FB.db, 'users', targetUid));
    if (!snap.exists()) return { ok: false, message: '相手の情報が見つかりませんでした' };
    target = snap.data();
  } catch (e) {
    console.warn('[friends] lookup failed', e);
    return { ok: false, message: cloudErrorMessage(e, 'フレンドの確認') };
  }
  return linkFriend(targetUid, {
    name: target.name || fallbackName || 'プレイヤー',
    icon: target.icon || '🙂', code: target.friendCode || ''
  });
}

/**
 * フレンドではない他のプレイヤーの貸し出しキャラを拾う。
 * ここからサポートに借りて、クリア後にフレンド登録へ誘導する。
 * 読み取り数を抑えるため取得件数に上限を置き、呼び出し側で使い回す。
 */
export async function fetchStrangerRentals(want = 6) {
  if (!firebaseEnabled() || !myUid) return [];
  try {
    const snaps = await FB.getDocs(FB.query(FB.collection(FB.db, 'users'), FB.limit(30)));
    const friendIds = new Set(state.profile.friends.map(f => f.uid));
    const pool = [];
    snaps.forEach(d => {
      if (d.id === myUid || friendIds.has(d.id)) return;
      const v = d.data();
      const charId = v.rentalCharId || v.rentalMonsterId;
      if (!charId) return;
      pool.push({
        uid: d.id, name: v.name || 'プレイヤー', icon: v.icon || '🙂', stranger: true,
        charId, star: v.rentalStar || null, lv: v.rentalLv || 1, awa: v.rentalAwa || 0
      });
    });
    // 毎回同じ顔ぶれにならないよう混ぜる
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, want);
  } catch (e) { return []; }
}

/* ===================== 貸し出しの使用回数 ===================== */
/**
 * 他プレイヤーのキャラをサポートに借りたとき、その持ち主の使用回数を1つ増やす。
 * 持ち主は翌日にまとめてフレポを受け取る。
 */
export async function countRentalUse(ownerUid) {
  if (!firebaseEnabled() || !myUid || !ownerUid || ownerUid === myUid) return;
  try {
    await FB.updateDoc(FB.doc(FB.db, 'users', ownerUid), { rentalUseCount: FB.increment(1) });
  } catch (e) { /* 失敗してもゲーム進行には影響させない */ }
}

/**
 * 前日までに自分のキャラが使われたぶんのフレポを受け取る。
 * 同じ日に二重取りしないよう、受取日を記録して1日1回に制限する。
 * @returns {{gained:number, uses:number}|null}
 */
async function claimRentalReward(myRef, data) {
  const today = todayStr();
  if (data.lastRentalRewardDate === today) return null;   // 今日はもう受け取り済み
  const uses = (data.rentalUseCount || 0) - (data.rentalRewardedCount || 0);
  if (uses <= 0) {
    // 受け取るものが無くても日付だけ進めておく(初回など)
    if (!data.lastRentalRewardDate) {
      await FB.updateDoc(myRef, { lastRentalRewardDate: today });
    }
    return null;
  }
  const gained = uses * FRIEND_RENTAL_REWARD;
  addGift({
    title: '貸し出しキャラのお礼',
    note: `あなたのキャラクターが${uses}回使われました`,
    frepo: gained
  });
  await FB.updateDoc(myRef, {
    rentalRewardedCount: data.rentalUseCount || 0,
    lastRentalRewardDate: today
  });
  return { gained, uses };
}

/** 起動時に受け取った貸し出し報酬(画面側で知らせるために持っておく) */
let lastRentalClaim = null;
export function takeRentalClaim() {
  const r = lastRentalClaim;
  lastRentalClaim = null;
  return r;
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
