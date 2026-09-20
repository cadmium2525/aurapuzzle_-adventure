/* ===================== ショップ画面 =====================
 * 商品はコイン建てとダイヤ建てが混ざる。1日に買える数に上限のある
 * 商品(スタミナドリンク)もあるので、残り本数もここで見せる。
 * =======================================================*/
import { $, toast, itemIcon } from '../core/ui.js';
import {
  state, saveState, addCharacter, addMaterials,
  shopRemaining, shopRemainingToday, shopRemainingTotal, recordShopPurchase
} from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, SHOP_ITEMS, RARITY_TITLE, resolveCharacter, materialById, shopCrystalToday
} from '../data/gamedata.js';
import { portraitHTML } from './parts.js';
import { eventShopItems, activeEvents, isAvailable } from '../data/availability.js';
const balance = currency => currency === 'coin' ? state.coin : currency === 'orb' ? state.orb : (state.materials[currency] || 0);

/**
 * その商品が今日の棚に並ぶか。
 * 「今日の結晶」は曜日ダンジョンに連動するので、結晶の落ちない
 * 金曜(ゴールド)と日曜(経験値)には出さない。
 */
function inStock(item) {
  return isAvailable(item) && (item.type !== 'crystalToday' || !!shopCrystalToday());
}

/** その商品が渡す素材のID(素材でなければ null) */
function materialIdOf(item) {
  if (item.type === 'material') return item.matId;
  if (item.type === 'crystalToday') return shopCrystalToday();
  return null;
}

/**
 * 商品ごとの見せ方。type を増やしたらここに足す。
 * name は行の見出し(HTMLを含むことがある)、plain はトースト用の素の名前。
 */
function present(item) {
  const matId = materialIdOf(item);
  if (matId) {
    const mt = materialById(matId);
    return {
      visual: itemIcon(matId, 'shop'),
      name: mt.name, plain: mt.name,
      desc: `×${item.amount}${item.note ? ` ・ ${item.note}` : ''}`
    };
  }
  if (item.type === 'character') {
    const ch = resolveCharacter(item.charId, null, 1);
    return {
      visual: portraitHTML(ch),
      name: `${ch.name}<span class="shop-job">${ch.job}</span>`, plain: ch.name,
      desc: `${AURAS[ch.aura].emoji}${AURAS[ch.aura].name} ・ ${RARITY_TITLE[ch.rarity]} ・ ATK ${ch.atk} / HP ${ch.hp}`
    };
  }
  if (item.type === 'orb') {
    // コインをダイヤに替える唯一の道。1日1個までで蛇口を止めている
    return { visual: itemIcon('orb', 'shop'), name: 'オーブ小袋', plain: 'オーブ小袋',
      desc: `オーブ +${item.amount}` };
  }
  if (item.type === 'frepo') {
    return { visual: itemIcon('frepo', 'shop'), name: 'フレンドポイント袋', plain: 'フレンドポイント袋',
      desc: `フレポ +${item.amount}` };
  }
  return {
    visual: itemIcon('stamina', 'shop'),
    name: 'スタミナドリンク', plain: 'スタミナドリンク',
    // 上限を超えて持てるのはランクアップと同じ扱い。満タンでも無駄にならない
    desc: `スタミナ +${item.amount}（上限を超えて持てる）`
  };
}

/** 買ったときに所持数へ反映する */
function grant(item) {
  const matId = materialIdOf(item);
  if (matId) { addMaterials({ [matId]: item.amount }); return; }
  if (item.type === 'character') addCharacter(item.charId);
  if (item.type === 'orb') state.orb += item.amount;
  if (item.type === 'frepo') state.frepo += item.amount;
  if (item.type === 'stamina') state.stamina += item.amount;
}

export function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';
  activeEvents().forEach(e=>{
    const info=document.createElement('p');
    info.textContent=`${e.name} 交換所 ・ ${e.currency.name} 所持 ${balance(e.currency.id)}個`;
    list.appendChild(info);
  });
  [...eventShopItems(),...SHOP_ITEMS].filter(inStock).forEach(item => {
    const { visual, name, plain, desc } = present(item);
    const currency = item.currency || 'coin';
    const left = shopRemaining(item);
    const soldOut = left <= 0;
    // 買い切りを取り切ったのか、今日ぶんが尽きただけなのかで言い方を変える
    const bought = shopRemainingTotal(item) <= 0;
    const poor = balance(currency) < item.price;

    const row = document.createElement('div');
    row.className = 'shop-row' + (soldOut ? ' sold-out' : '');
    row.innerHTML = `${visual}
      <div class="sinfo2">
        <div class="sname2">${name}</div>
        <div class="sprice">${desc}</div>
        ${item.dailyLimit ? `<div class="shop-limit">本日あと <b>${shopRemainingToday(item)}</b> / ${item.dailyLimit} ${item.unit || '個'}</div>` : ''}
        ${item.totalLimit && !bought ? '<div class="shop-limit">買い切り</div>' : ''}
      </div>
      <button class="btn buybtn"${soldOut ? ' disabled' : ''}>${
        soldOut ? (bought ? '購入済み' : '本日分は完売')
                : `${itemIcon(currency)}${item.price.toLocaleString()}`}</button>`;

    row.querySelector('button').addEventListener('click', () => {
      if (!inStock(item)) { toast('交換期間が終了しました'); renderShop(); return; }
      // 押した時点で改めて見る。日付が変わっていれば日ぶんの上限は戻る
      if (shopRemainingTotal(item) <= 0) { toast('すでに購入済みです'); renderShop(); return; }
      if (shopRemainingToday(item) <= 0) { toast('本日分は売り切れです'); renderShop(); return; }
      if (balance(currency) < item.price) {
        toast(`${materialById(currency)?.name || (currency === 'orb' ? 'オーブ' : 'コイン')}が足りません`); return;
      }
      if (currency === 'orb') state.orb -= item.price;
      else if (currency === 'coin') state.coin -= item.price;
      else state.materials[currency] -= item.price;
      grant(item);
      saveState();
      recordShopPurchase(item);
      updateStatusBar();
      toast(item.type === 'stamina' ? `スタミナ +${item.amount}` : `${plain} を購入しました`);
      renderShop();
    });
    if (poor && !soldOut) row.classList.add('too-poor');
    list.appendChild(row);
  });
}
