/* =========================================================
 * firebase.js — Firebase 初期化(Auth + Firestore)
 * 各種データ(セーブデータ/プロフィール/フレンド)の保管に使用する。
 *
 * SDKは「設定済みのときだけ」動的importで読み込む。
 * こうしておくと、オフラインやCDNに到達できない環境でも
 * ゲーム本体(ローカル保存)はそのまま遊べる。
 *
 * 認証は2段構え。
 *   1. 起動時は匿名でサインインする(すぐ遊べる。uidにセーブが紐づく)
 *   2. マイページでID/パスワードを登録すると、匿名アカウントを
 *      linkWithCredential で「昇格」させる。uidが変わらないので
 *      それまでのセーブとフレンド関係がそのまま引き継がれる。
 *
 * ★ Firestore のセキュリティルールは README.md を参照してください。
 * =======================================================*/

const firebaseConfig = {
  apiKey: 'AIzaSyCoitaboqXM8fUStrzCAUX0auuE_ZoSMSg',
  authDomain: 'aura-connect-2525.firebaseapp.com',
  projectId: 'aura-connect-2525',
  storageBucket: 'aura-connect-2525.firebasestorage.app',
  messagingSenderId: '883937663453',
  appId: '1:883937663453:web:ca25e4dac2d8929f85fe34'
};

const SDK = 'https://www.gstatic.com/firebasejs/10.13.2';
const isConfigured = !/YOUR_/.test(firebaseConfig.apiKey);

/** Firestore の API をまとめて保持する(SDK読み込み後に埋まる) */
export const FB = {
  ready: false, db: null,
  doc: null, getDoc: null, setDoc: null, updateDoc: null, deleteField: null,
  collection: null, getDocs: null, query: null, limit: null,
  serverTimestamp: null, increment: null, runTransaction: null
};

/** Auth の API をまとめて保持する(SDK読み込み後に埋まる) */
export const AUTH = {
  ready: false, auth: null, user: null,
  EmailAuthProvider: null, linkWithCredential: null,
  signInWithEmailAndPassword: null, signInAnonymously: null, signOut: null
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
        query: fsMod.query, limit: fsMod.limit,
        serverTimestamp: fsMod.serverTimestamp, increment: fsMod.increment,
        runTransaction: fsMod.runTransaction,
        ready: true
      });
      Object.assign(AUTH, {
        auth,
        EmailAuthProvider: authMod.EmailAuthProvider,
        linkWithCredential: authMod.linkWithCredential,
        signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
        signInAnonymously: authMod.signInAnonymously,
        signOut: authMod.signOut,
        ready: true
      });

      uidPromise = new Promise(resolve => {
        let settled = false;
        const done = v => { if (!settled) { settled = true; resolve(v); } };
        authMod.onAuthStateChanged(auth, async user => {
          AUTH.user = user || null;
          if (user) { done(user.uid); return; }
          // 誰もサインインしていないときだけ匿名で入る。
          // 無条件に signInAnonymously すると、登録済みユーザーが
          // リロードのたびに匿名アカウントへ差し替えられてしまう。
          if (settled) return;
          try { await authMod.signInAnonymously(auth); }  // 成功すれば上の分岐が再度走る
          catch (e) { done(null); }
        });
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

/** 最初のサインインが済んだ時点の uid を返す(未設定/失敗時はnull) */
export async function getUid() {
  if (!firebaseEnabled()) return null;
  return uidPromise;
}

/** 現在サインイン中の uid(未サインインなら null) */
export function currentUid() { return AUTH.user ? AUTH.user.uid : null; }

/** 匿名のまま(=アカウント未登録)かどうか */
export function isAnonymous() { return !!(AUTH.user && AUTH.user.isAnonymous); }

/** 登録済みアカウントのメールアドレス(未登録なら null) */
export function currentEmail() { return (AUTH.user && AUTH.user.email) || null; }
