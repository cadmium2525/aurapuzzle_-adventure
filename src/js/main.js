/* =========================================================
 * main.js — エントリポイント。各モジュールの初期化と画面登録。
 * =======================================================*/
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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
