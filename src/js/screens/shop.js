/* ===================== ショップ画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, saveState, addCharacter } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import { AURAS, SHOP_ITEMS, RARITY_TITLE, characterById } from '../data/gamedata.js';
import { portraitHTML } from './parts.js';

export function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    let visual = '', name = '', desc = '';
    if (item.type === 'character') {
      const ch = characterById(item.charId);
      visual = portraitHTML(ch);
      name = `${ch.name}<span class="shop-job">${ch.job}</span>`;
      desc = `${AURAS[ch.aura].emoji}${AURAS[ch.aura].name} ・ ${RARITY_TITLE[ch.rarity]} ・ ATK ${ch.atk} / HP ${ch.hp}`;
    } else if (item.type === 'orb') {
      visual = `<span class="shop-emoji">${item.emoji}</span>`;
      name = 'オーブ小袋'; desc = `オーブ +${item.amount}`;
    } else if (item.type === 'frepo') {
      visual = `<span class="shop-emoji">${item.emoji}</span>`;
      name = 'フレンドポイント袋'; desc = `フレポ +${item.amount}`;
    }
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `${visual}
      <div class="sinfo2"><div class="sname2">${name}</div><div class="sprice">${desc}</div></div>
      <button class="btn buybtn">💰${item.price.toLocaleString()}</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (state.coin < item.price) { toast('コインが足りません'); return; }
      state.coin -= item.price;
      if (item.type === 'character') addCharacter(item.charId);
      if (item.type === 'orb') state.orb += item.amount;
      if (item.type === 'frepo') state.frepo += item.amount;
      saveState();
      updateStatusBar();
      toast('購入しました');
    });
    list.appendChild(row);
  });
}
