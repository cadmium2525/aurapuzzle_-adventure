import test from 'node:test';
import assert from 'node:assert/strict';
import { eventShopItems, isAvailable } from '../src/js/data/availability.js';
import { state, recordShopPurchase, shopRemainingTotal } from '../src/js/core/state.js';
import { activeHomeTheme, ownedHomeThemes, setHomeTheme } from '../src/js/core/home-theme.js';

const theme = eventShopItems().find(item => item.type === 'homeTheme' && item.eventId === 'halloween_2026');

test('Halloween background is exchangeable only during the event', () => {
  assert.ok(theme);
  assert.equal(isAvailable(theme, Date.parse('2026-09-30T23:59:59+09:00')), false);
  assert.equal(isAvailable(theme, Date.parse('2026-10-01T00:00:00+09:00')), true);
  assert.equal(isAvailable(theme, Date.parse('2026-11-01T00:00:00+09:00')), false);
});

test('one-time purchase unlocks theme permanently and does not force it on', () => {
  const previousTotal = state.shopTotal[theme.id];
  const previousSelection = state.settings.homeThemeId;
  try {
    delete state.shopTotal[theme.id];
    state.settings.homeThemeId = 'default';
    assert.equal(setHomeTheme(theme.themeId), false);
    assert.equal(ownedHomeThemes().length, 0);
    recordShopPurchase(theme);
    assert.equal(shopRemainingTotal(theme), 0);
    assert.equal(ownedHomeThemes().length, 1);
    assert.equal(setHomeTheme(theme.themeId), true);
    assert.equal(activeHomeTheme()?.image, theme.image);
    assert.equal(setHomeTheme('default'), true);
    assert.equal(activeHomeTheme(), null);
    // Availability controls acquisition, not ownership after the period ends.
    assert.equal(setHomeTheme(theme.themeId), true);
  } finally {
    if (previousTotal === undefined) delete state.shopTotal[theme.id];
    else state.shopTotal[theme.id] = previousTotal;
    state.settings.homeThemeId = previousSelection;
  }
});
