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
import { initSettings, renderSettings } from './screens/settings.js';

registerScreen('home', renderHome);
registerScreen('dungeon', renderDungeon);
registerScreen('monster', renderMonsterScreen);
registerScreen('shop', renderShop);
registerScreen('settings', renderSettings);

initNav();
initSysModal();
initDungeon();
initMonster();
initGacha();
initSettings();
initBattle();

showScreen('home', false);
updateStatusBar();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
