/* =========================================================
 * account.js — ID + パスワードによるアカウント登録 / ログイン
 *
 * Firebase のメール/パスワード認証を使うが、プレイヤーにメールアドレスは
 * 入力させない。入力された「ID」を実在しないドメイン(.invalid は RFC 2606 で
 * 永久に予約されている)のアドレスへ変換して内部的に使う。
 *
 * ・登録は linkWithCredential。匿名アカウントを昇格させるので uid が変わらず、
 *   それまでのセーブとフレンド関係がそのまま残る。
 * ・ID の重複チェックは Firebase 側が auth/email-already-in-use を返すため、
 *   Firestore 側でユニーク制約を作る必要がない。
 * ・架空アドレスなのでパスワード再設定メールは送れない。忘れると復旧できない
 *   ことを登録画面で明示すること。
 * =======================================================*/
import { AUTH, firebaseEnabled, isAnonymous, currentEmail, currentUid } from './firebase.js';
import { replaceSavedState, resetState } from './state.js';
import { fetchCloudState } from './friends.js';

/** 実在しないドメイン。ここを所有ドメインに変えても動作は同じ */
const EMAIL_DOMAIN = 'users.aura-connect.invalid';

export const ID_PATTERN = /^[a-z0-9_-]{3,16}$/;
export const MIN_PASSWORD = 6;

/** 全角や大文字のゆらぎで別IDにならないように正規化する */
export function normalizeId(raw) {
  return String(raw || '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .toLowerCase();
}

const toEmail = id => `${id}@${EMAIL_DOMAIN}`;

/** 内部アドレスから表示用のIDへ戻す */
export function idFromEmail(email) {
  const at = (email || '').indexOf('@');
  return at > 0 ? email.slice(0, at) : null;
}

/** ログイン中アカウントのID(未登録なら null) */
export function currentAccountId() { return idFromEmail(currentEmail()); }

/** 画面表示用のログイン状態 */
export function accountStatus() {
  if (!firebaseEnabled()) return { state: 'offline' };
  if (!currentUid()) return { state: 'connecting' };
  if (isAnonymous()) return { state: 'guest' };
  return { state: 'signedIn', id: currentAccountId() };
}

const MESSAGES = {
  'auth/email-already-in-use':    'このIDはすでに使われています',
  'auth/credential-already-in-use': 'このIDはすでに使われています',
  'auth/provider-already-linked': 'この端末ではすでにアカウント登録が済んでいます',
  'auth/invalid-credential':      'IDまたはパスワードが違います',
  'auth/user-not-found':          'IDまたはパスワードが違います',
  'auth/wrong-password':          'IDまたはパスワードが違います',
  'auth/invalid-email':           'IDに使えない文字が含まれています',
  'auth/weak-password':           `パスワードは${MIN_PASSWORD}文字以上にしてください`,
  'auth/too-many-requests':       '試行が多すぎます。しばらく待ってからお試しください',
  'auth/network-request-failed':  '通信に失敗しました。接続を確認してください'
};
const messageFor = (e, fallback) => MESSAGES[e && e.code] || fallback;

/** ID / パスワードの入力チェック。問題なければ null を返す */
function validate(id, password) {
  if (!ID_PATTERN.test(id)) return 'IDは半角英数字と _ - で3〜16文字にしてください';
  if ((password || '').length < MIN_PASSWORD) return `パスワードは${MIN_PASSWORD}文字以上にしてください`;
  return null;
}

/**
 * 今遊んでいるデータのままアカウントを登録する(匿名アカウントの昇格)。
 * uid が変わらないので、セーブもフレンドも引き継がれる。
 */
export async function registerAccount(rawId, password) {
  const id = normalizeId(rawId);
  const bad = validate(id, password);
  if (bad) return { ok: false, message: bad };
  if (!firebaseEnabled()) return { ok: false, message: 'クラウド機能が利用できません' };

  const user = AUTH.user;
  if (!user) return { ok: false, message: '接続の準備中です。少し待ってからお試しください' };
  if (!user.isAnonymous) return { ok: false, message: 'すでにアカウント登録が済んでいます' };

  try {
    const cred = AUTH.EmailAuthProvider.credential(toEmail(id), password);
    await AUTH.linkWithCredential(user, cred);
    AUTH.user = AUTH.auth.currentUser;      // 昇格後の状態を確実に反映させる
    return { ok: true, message: `ID「${id}」で登録しました` };
  } catch (e) {
    return { ok: false, message: messageFor(e, '登録に失敗しました') };
  }
}

/**
 * 別のアカウントでログインし、クラウドのセーブでこの端末を上書きする。
 * 成功したら reload:true を返すので、呼び出し側でリロードすること。
 */
export async function loginAccount(rawId, password) {
  const id = normalizeId(rawId);
  const bad = validate(id, password);
  if (bad) return { ok: false, message: bad };
  if (!firebaseEnabled()) return { ok: false, message: 'クラウド機能が利用できません' };

  try {
    const res = await AUTH.signInWithEmailAndPassword(AUTH.auth, toEmail(id), password);
    const cloud = await fetchCloudState(res.user.uid);
    if (cloud) replaceSavedState(cloud);
    else resetState();          // クラウドにデータが無いアカウント(通常は起こらない)
    return { ok: true, reload: true, message: `ID「${id}」でログインしました` };
  } catch (e) {
    return { ok: false, message: messageFor(e, 'ログインに失敗しました') };
  }
}

/**
 * ログアウトする。この端末のローカルデータは消し、次回起動時に
 * 新しいゲストとして始まる(アカウントのデータはクラウドに残る)。
 */
export async function logoutAccount() {
  try {
    await AUTH.signOut(AUTH.auth);
    resetState();
    return { ok: true, reload: true, message: 'ログアウトしました' };
  } catch (e) {
    return { ok: false, message: messageFor(e, 'ログアウトに失敗しました') };
  }
}
