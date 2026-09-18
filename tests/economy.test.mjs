import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_THEMES, dailyStagesFor, AURAS, SHOP_ITEMS, STAMINA_DRINK, ORB_POUCH,
  DISMISS_REWARD, MATERIALS
} from '../src/js/data/gamedata.js';
import { CHARACTERS } from '../src/js/data/characters.js';

test('進化素材の結晶は全オーラぶん曜日ダンジョンで取れる', () => {
  // 常闇(4)だけ曜日が無く、通常ダンジョンでも50ステージ中8つしか落ちなかった。
  // キャラが存在するオーラの結晶は、どれかの曜日で必ず取れること。
  const covered = new Set(DAILY_THEMES.filter(t => t.dropType === 'crystal').map(t => t.dropAura));
  const needed = new Set(CHARACTERS.map(c => c.aura));
  for (const aura of needed) {
    assert.ok(covered.has(aura),
      `${AURAS[aura].name}(${aura})の結晶を落とす曜日ダンジョンが無い`);
  }
});

test('曜日ダンジョンは7日ぶんそろっていて、経験値の日も残っている', () => {
  assert.equal(DAILY_THEMES.length, 7);
  DAILY_THEMES.forEach((t, day) => {
    assert.equal(t.day, day);
    assert.ok(dailyStagesFor(day).length > 0, `${t.label}曜のステージが無い`);
  });
  assert.ok(DAILY_THEMES.some(t => t.dropType === 'exp'), '経験値アイテムの曜日が消えた');
  assert.ok(DAILY_THEMES.some(t => t.dropType === 'gold'), 'ゴールドの曜日が消えた');
});

test('結晶の落ちる曜日は、その結晶が実在するオーラを指している', () => {
  const crystalIds = new Set(MATERIALS.filter(m => m.aura !== null).map(m => m.aura));
  DAILY_THEMES.filter(t => t.dropType === 'crystal').forEach(t => {
    assert.ok(crystalIds.has(t.dropAura), `${t.label}曜の dropAura ${t.dropAura} に対応する結晶が無い`);
  });
});

test('ショップのキャラは買い切り(買って送還で素材を増やせない)', () => {
  SHOP_ITEMS.filter(i => i.type === 'character').forEach(item => {
    assert.ok(item.totalLimit > 0, `${item.id} が買い切りでない`);
    // 念のため、送還で戻るコインが購入価格を超えていないこと
    const base = CHARACTERS.find(c => c.id === item.charId);
    assert.ok(DISMISS_REWARD[base.rarity].coin < item.price,
      `${item.id} は送還のほうがコインが増える`);
  });
});

test('コイン→ダイヤの蛇口が1日で閉じ、ドリンクで回しても赤字になる', () => {
  const pouch = SHOP_ITEMS.find(i => i.type === 'orb');
  assert.ok(pouch.dailyLimit > 0, '小袋に上限が無いとコイン収入がそのままダイヤになる');
  const perDay = pouch.amount * pouch.dailyLimit;          // 1日に得られるダイヤ
  const drinkCost = STAMINA_DRINK.price * STAMINA_DRINK.dailyLimit;
  assert.ok(perDay < drinkCost,
    `ダイヤ→スタミナ→コイン→ダイヤ が黒字になっている(戻り ${perDay} / 払い ${drinkCost})`);
  assert.equal(pouch.price, ORB_POUCH.price);
});
