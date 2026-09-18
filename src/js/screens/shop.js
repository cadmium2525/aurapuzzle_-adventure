/* ===================== ショップ画面 =====================
 * 商品はコイン建てとダイヤ建てが混ざる。1日に買える数に上限のある
 * 商品(スタミナドリンク)もあるので、残り本数もここで見せる。
 * =======================================================*/
import { $, toast, itemIcon } from '../core/ui.js';
import {
  state, saveState, addCharacter, shopRemainingToday, recordShopPurchase
} from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import { AURAS, SHOP_ITEMS, RARITY_TITLE, resolveCharacter } from '../data/gamedata.js';
import { portraitHTML } from './parts.js';

/** 商品ごとの見せ方。type を増やしたらここに足す */
function present(item) {
  if (item.type === 'character') {
    const ch = resolveCharacter(item.charId, null, 1);
    return {
      visual: portraitHTML(ch),
      name: `${ch.name}<span class="shop-job">${ch.job}</span>`,
      desc: `${AURAS[ch.aura].emoji}${AURAS[ch.aura].name} ・ ${RARITY_TITLE[ch.rarity]} ・ ATK ${ch.atk} / HP ${ch.hp}`
    };
  }
  if (item.type === 'orb') {
    return { visual: itemIcon('orb', 'shop'), name: 'オーブ小袋', desc: `オーブ +${item.amount}` };
  }
  if (item.type === 'frepo') {
    return { visual: itemIcon('frepo', 'shop'), name: 'フレンドポイント袋', desc: `フレポ +${item.amount}` };
  }
  return {
    visual: itemIcon('stamina', 'shop'),
    name: 'スタミナドリンク',
    // 上限を超えて持てるのはランクアップと同じ扱い。満タンでも無駄にならない
    desc: `スタミナ +${item.amount}（上限を超えて持てる）`
  };
}

/** 買ったときに所持数へ反映する */
function grant(item) {
  if (item.type === 'character') addCharacter(item.charId);
  if (item.type === 'orb') state.orb += item.amount;
  if (item.type === 'frepo') state.frepo += item.amount;
  if (item.type === 'stamina') state.stamina += item.amount;
}

export function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const { visual, name, desc } = present(item);
    const currency = item.currency || 'coin';
    const left = shopRemainingToday(item);
    const soldOut = left <= 0;
    const poor = (currency === 'orb' ? state.orb : state.coin) < item.price;

    const row = document.createElement('div');
    row.className = 'shop-row' + (soldOut ? ' sold-out' : '');
    row.innerHTML = `${visual}
      <div class="sinfo2">
        <div class="sname2">${name}</div>
        <div class="sprice">${desc}</div>
        ${item.dailyLimit ? `<div class="shop-limit">本日あと <b>${left}</b> / ${item.dailyLimit} 本</div>` : ''}
      </div>
      <button class="btn buybtn"${soldOut ? ' disabled' : ''}>${
        soldOut ? '本日分は完売' : `${itemIcon(currency)}${item.price.toLocaleString()}`}</button>`;

    row.querySelector('button').addEventListener('click', () => {
      // 押した時点で改めて見る。日付が変わっていれば上限も戻る
      if (shopRemainingToday(item) <= 0) { toast('本日分は売り切れです'); renderShop(); return; }
      if (currency === 'orb' ? state.orb < item.price : state.coin < item.price) {
        toast(currency === 'orb' ? 'オーブが足りません' : 'コインが足りません'); return;
      }
      if (currency === 'orb') state.orb -= item.price; else state.coin -= item.price;
      grant(item);
      saveState();
      if (item.dailyLimit) recordShopPurchase(item.id);
      updateStatusBar();
      toast(item.type === 'stamina' ? `スタミナ +${item.amount}` : '購入しました');
      renderShop();
    });
    if (poor && !soldOut) row.classList.add('too-poor');
    list.appendChild(row);
  });
}
