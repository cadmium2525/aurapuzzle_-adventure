/* =========================================================
 * firebase.js — Firebase 初期化(Auth匿名ログイン + Firestore)
 * 各種データ(セーブデータ/プロフィール/フレンド)の保管に使用する。
 *
 * ★ 使用前に必ず下記 firebaseConfig をご自身の Firebase プロジェクトの
 *    設定値に置き換えてください(Firebaseコンソール > プロジェクトの設定 >全般 > マイアプリ)。
 * ★ Firestore のセキュリティルールは README.md を参照してください。
 * =======================================================*/
import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteField,
  collection, getDocs, serverTimestamp, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// TODO: ご自身の Firebase プロジェクトの設定に置き換えてください
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const isConfigured = !/YOUR_/.test(firebaseConfig.apiKey);

let app = null, auth = null, db = null;
let uidPromise = Promise.resolve(null);

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    uidPromise = new Promise(resolve => {
      let done = false;
      onAuthStateChanged(auth, user => {
        if (user && !done) { done = true; resolve(user.uid); }
      });
      signInAnonymously(auth).catch(() => { if (!done) { done = true; resolve(null); } });
    });
  } catch (e) {
    console.warn('[firebase] init failed', e);
  }
}

/** Firebase が利用可能かどうか */
export function firebaseEnabled() { return isConfigured && !!db; }

/** 匿名ログインが完了したUIDを返す(未設定/失敗時はnull) */
export async function getUid() {
  if (!firebaseEnabled()) return null;
  return uidPromise;
}

export {
  db, doc, getDoc, setDoc, updateDoc, deleteField,
  collection, getDocs, serverTimestamp, increment, runTransaction
};
