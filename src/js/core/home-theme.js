/* 交換したホーム背景はイベント終了後も所持・使用できる。 */
import { state, saveState, shopBoughtTotal } from './state.js';
import { eventShopItems } from '../data/availability.js';

export const DEFAULT_HOME_THEME = 'default';

export function ownedHomeThemes() {
  return eventShopItems().filter(item =>
    item.type === 'homeTheme' && item.themeId && item.image && shopBoughtTotal(item.id) > 0);
}

export function activeHomeTheme() {
  return ownedHomeThemes().find(item => item.themeId === state.settings.homeThemeId) || null;
}

export function setHomeTheme(themeId) {
  if (themeId !== DEFAULT_HOME_THEME && !ownedHomeThemes().some(item => item.themeId === themeId)) return false;
  state.settings.homeThemeId = themeId;
  saveState();
  return true;
}
