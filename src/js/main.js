/* =========================================================
 * main.js — エントリポイント。各モジュールの初期化と画面登録。
 * =======================================================*/
import { APP_VERSION } from './core/version.js';
import { resetApp, showBootError } from './core/recovery.js';
import { initNav, registerScreen, showScreen, updateStatusBar } from './core/nav.js';
import { initSysModal } from './core/sysmodal.js';
import { initBattle } from './battle/battle.js';
import { initHome, renderHome } from './screens/home.js';
import { initDungeon, renderDungeon } from './screens/dungeon.js';
import { initTraining, renderTraining } from './screens/training.js';
import { initCharacter, renderCharacterScreen } from './screens/character.js';
import { initGacha, renderGacha } from './screens/gacha.js';
import { renderShop } from './screens/shop.js';
import { renderGuide } from './screens/guide.js';
import { initMypage, renderMypage, openRentalPicker } from './screens/mypage.js';
import { initFriends, renderFriends } from './screens/friends.js';
import { initPresent, updatePresentBadge } from './screens/present.js';
import { initCloud, takeRentalClaim } from './core/friends.js';
import { checkLoginBonus, checkBuiltinGifts, fetchOperatorGifts } from './core/gifts.js';
import { applyAdminGrant } from './core/account.js';
import { toast } from './core/ui.js';
import { runBoot } from './core/boot.js';
import { initAudio, startBgm } from './core/audio.js';

registerScreen('home', renderHome);
registerScreen('dungeon', renderDungeon);
registerScreen('training', renderTraining);
registerScreen('character', renderCharacterScreen);
registerScreen('gacha', renderGacha);
registerScreen('shop', renderShop);
registerScreen('guide', renderGuide);
registerScreen('mypage', renderMypage);
registerScreen('friends', renderFriends);

/* ===================== 版の食い違いを直す =====================
 * サービスワーカーはHTMLとJSを別々に取りに行くので、通信が不安定だと
 * 「古いHTML + 新しいJS」で起動してしまうことがある。その状態では
 * 下の init*() が無い要素を触って落ち、ローディングが0%のまま固まる。
 * 何かを触る前に見つけて、キャッシュを捨てて読み込み直す。
 * (読み直しても直らないときに繰り返さないよう、1回だけ試す)
 * ============================================================ */
const RELOAD_MARK = 'acb_version_reload';
const pageVersion = (document.querySelector('meta[name="app-version"]') || {}).content || '';
if (pageVersion !== APP_VERSION) {
  if (sessionStorage.getItem(RELOAD_MARK) === APP_VERSION) {
    // 読み直しても揃わない。固まらせずに、何が起きたかを画面に出す
    showBootError(`表示中のページ(${pageVersion || '不明'})とプログラム(${APP_VERSION})の版が違います`);
  } else {
    sessionStorage.setItem(RELOAD_MARK, APP_VERSION);
    resetApp();
  }
  throw new Error(`version mismatch: page=${pageVersion} app=${APP_VERSION}`);
}
sessionStorage.removeItem(RELOAD_MARK);

// 起動の途中で落ちても0%のまま固まらせない。index.html 側の見張り番は
// 新しいHTMLにしか無いので、JS側でも同じ受け皿を用意しておく。
window.addEventListener('error', e => { if (e instanceof ErrorEvent) showBootError(e.message); }, true);
window.addEventListener('unhandledrejection', e => {
  showBootError(e.reason && e.reason.message ? e.reason.message : e.reason);
});

initNav();
initSysModal();
initDungeon();
initTraining();
initCharacter();
initGacha();
initHome();
initMypage();
document.getElementById('statusProfileIcon')
  .addEventListener('click', openRentalPicker);
initFriends();
initPresent();
initBattle();
initAudio();

// その日はじめての起動ならログインボーナスをプレゼントボックスへ入れる
const login = checkLoginBonus();
// まだ配っていない配布ぶん(闇のキャラクターなど)も入れておく
checkBuiltinGifts();

function startCloudSync() {
  // Firebase(匿名ログイン+データ同期)は失敗してもゲーム本体に影響させない
  initCloud()
    .then(async () => {
      const granted = applyAdminGrant();
      if (granted) { updateStatusBar(); toast(`管理者アカウント: 💎${granted} を付与しました`); }
      const claim = takeRentalClaim();
      if (claim) toast(`貸し出しキャラが${claim.uses}回使われました 🎁 プレゼントボックスへ`);
      await fetchOperatorGifts();
      updatePresentBadge();
    })
    .catch(() => {});
}

runBoot(() => {
  startBgm();
  showScreen('home');
  updateStatusBar();
  if (login) toast(`ログインボーナス ${login.streak}日目 🎁 プレゼントボックスへ`);
  startCloudSync();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache:'none' で sw.js 自体が端末のキャッシュに居座らないようにする。
    // これをしないと新しい版に気づくのが何日も遅れることがある。
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
  // 新しいサービスワーカーが主導権を取ったら、一度だけ読み直して版をそろえる
  let swapped = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swapped) return;
    swapped = true;
    location.reload();
  });
}
