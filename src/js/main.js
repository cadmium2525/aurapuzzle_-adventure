/* =========================================================
 * main.js — エントリポイント。各モジュールの初期化と画面登録。
 * =======================================================*/
import { initNav, registerScreen, showScreen, updateStatusBar } from './core/nav.js';
import { initSysModal } from './core/sysmodal.js';
import { initBattle } from './battle/battle.js';
import { renderHome } from './screens/home.js';
import { initDungeon, renderDungeon } from './screens/dungeon.js';
import { initMonster, renderMonsterScreen } from './screens/monster.js';
import { initGacha } from './screens/gacha.js';
import { renderShop } from './screens/shop.js';
import { initMypage, renderMypage } from './screens/mypage.js';
import { initFriends, renderFriends } from './screens/friends.js';
import { initCloud } from './core/friends.js';

registerScreen('home', renderHome);
registerScreen('dungeon', renderDungeon);
registerScreen('monster', renderMonsterScreen);
registerScreen('shop', renderShop);
registerScreen('mypage', renderMypage);
registerScreen('friends', renderFriends);

initNav();
initSysModal();
initDungeon();
initMonster();
initGacha();
initMypage();
initFriends();
initBattle();

showScreen('home', false);
updateStatusBar();

// Firebase(匿名ログイン+データ同期)は失敗してもゲーム本体に影響しないよう非同期で初期化
initCloud().catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
