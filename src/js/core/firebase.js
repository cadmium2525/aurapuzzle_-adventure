/* =========================================================
 * firebase.js — Firebase 初期化(Auth匿名ログイン + Firestore)
 * 各種データ(セーブデータ/プロフィール/フレンド)の保管に使用する。
 *
 * SDKは「設定済みのときだけ」動的importで読み込む。
 * こうしておくと、オフラインやCDNに到達できない環境でも
 * ゲーム本体(ローカル保存)はそのまま遊べる。
 *
 * ★ 使用前に下記 firebaseConfig をご自身の Firebase プロジェクトの
 *    設定値に置き換えてください(Firebaseコンソール > プロジェクトの設定 > マイアプリ)。
 * ★ Firestore のセキュリティルールは README.md を参照してください。
 * =======================================================*/

// TODO: ご自身の Firebase プロジェクトの設定に置き換えてください
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const SDK = 'https://www.gstatic.com/firebasejs/10.13.2';
const isConfigured = !/YOUR_/.test(firebaseConfig.apiKey);

/** Firestore の API をまとめて保持する(SDK読み込み後に埋まる) */
export const FB = {
  ready: false, db: null,
  doc: null, getDoc: null, setDoc: null, updateDoc: null, deleteField: null,
  collection: null, getDocs: null, serverTimestamp: null, increment: null, runTransaction: null
};

let uidPromise = Promise.resolve(null);
let initPromise = null;

/** SDKを読み込んで初期化する。多重呼び出ししても1回だけ実行される。 */
export function initFirebase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!isConfigured) return false;
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`)
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      Object.assign(FB, {
        db: fsMod.getFirestore(app),
        doc: fsMod.doc, getDoc: fsMod.getDoc, setDoc: fsMod.setDoc,
        updateDoc: fsMod.updateDoc, deleteField: fsMod.deleteField,
        collection: fsMod.collection, getDocs: fsMod.getDocs,
        serverTimestamp: fsMod.serverTimestamp, increment: fsMod.increment,
        runTransaction: fsMod.runTransaction,
        ready: true
      });
      uidPromise = new Promise(resolve => {
        let done = false;
        authMod.onAuthStateChanged(auth, user => {
          if (user && !done) { done = true; resolve(user.uid); }
        });
        authMod.signInAnonymously(auth).catch(() => { if (!done) { done = true; resolve(null); } });
      });
      return true;
    } catch (e) {
      console.warn('[firebase] init skipped', e && e.message);
      return false;
    }
  })();
  return initPromise;
}

/** Firebase が利用可能かどうか(未設定/読み込み失敗なら false) */
export function firebaseEnabled() { return isConfigured && FB.ready; }

/** 設定値が入っているか(SDKの読み込み結果は問わない) */
export function firebaseConfigured() { return isConfigured; }

/** 匿名ログインが完了したUIDを返す(未設定/失敗時はnull) */
export async function getUid() {
  if (!firebaseEnabled()) return null;
  return uidPromise;
}
