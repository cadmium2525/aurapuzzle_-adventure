/* ===================== ショップ画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, saveState, addMonster } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import { ELEMENTS, SHOP_ITEMS, monsterById } from '../data/gamedata.js';

export function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    let name = '', desc = '';
    if (item.type === 'monster') {
      const m = monsterById(item.monsterId);
      name = m.name;
      desc = `${ELEMENTS[m.element].name}属性 / ATK ${m.atk} / HP ${m.hp}`;
    } else if (item.type === 'orb') {
      name = 'オーブ小袋'; desc = `オーブ +${item.amount}`;
    } else if (item.type === 'frepo') {
      name = 'フレンドポイント袋'; desc = `フレポ +${item.amount}`;
    }
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<div class="semoji2">${item.emoji}</div>
      <div class="sinfo2"><div class="sname2">${name}</div><div class="sprice">${desc} ・ 💰${item.price}</div></div>
      <button class="btn" style="padding:8px 14px;font-size:11.5px;">購入</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (state.coin < item.price) { toast('コインが足りません'); return; }
      state.coin -= item.price;
      if (item.type === 'monster') addMonster(item.monsterId);
      if (item.type === 'orb') state.orb += item.amount;
      if (item.type === 'frepo') state.frepo += item.amount;
      saveState();
      updateStatusBar();
      toast('購入しました');
    });
    list.appendChild(row);
  });
}
