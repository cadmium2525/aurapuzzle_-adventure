/* =========================================================
 * main.js — エントリポイント。各モジュールの初期化と画面登録。
 * =======================================================*/
import { initNav, registerScreen, showScreen, updateStatusBar } from './core/nav.js';
import { initSysModal } from './core/sysmodal.js';
import { initBattle } from './battle/battle.js';
import { initHome, renderHome } from './screens/home.js';
import { initDungeon, renderDungeon } from './screens/dungeon.js';
import { initCharacter, renderCharacterScreen } from './screens/character.js';
import { initGacha, renderGacha } from './screens/gacha.js';
import { renderShop } from './screens/shop.js';
import { renderGuide } from './screens/guide.js';
import { initMypage, renderMypage, openRentalPicker } from './screens/mypage.js';
import { initFriends, renderFriends } from './screens/friends.js';
import { initCloud, takeRentalClaim } from './core/friends.js';
import { applyAdminGrant } from './core/account.js';
import { toast } from './core/ui.js';

registerScreen('home', renderHome);
registerScreen('dungeon', renderDungeon);
registerScreen('character', renderCharacterScreen);
registerScreen('gacha', renderGacha);
registerScreen('shop', renderShop);
registerScreen('guide', renderGuide);
registerScreen('mypage', renderMypage);
registerScreen('friends', renderFriends);

initNav();
initSysModal();
initDungeon();
initCharacter();
initGacha();
initHome();
initMypage();
document.getElementById('statusProfileIcon')
  .addEventListener('click', openRentalPicker);
initFriends();
initBattle();

showScreen('home', false);
updateStatusBar();

// Firebase(匿名ログイン+データ同期)は失敗してもゲーム本体に影響しないよう非同期で初期化
initCloud()
  .then(() => {
    // 別端末でのログイン後など、起動時点で管理者だった場合はここで付与する
    const granted = applyAdminGrant();
    if (granted) { updateStatusBar(); toast(`管理者アカウント: 💎${granted} を付与しました`); }
    // 自分のキャラが借りられたぶんのフレポ(前日までの合計)
    const claim = takeRentalClaim();
    if (claim) {
      updateStatusBar();
      toast(`貸し出しキャラが${claim.uses}回使われました 🎗️+${claim.gained}`);
    }
  })
  .catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
