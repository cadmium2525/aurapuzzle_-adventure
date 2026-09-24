import { $, itemIcon } from '../core/ui.js';
import { state } from '../core/state.js';
import { showScreen } from '../core/nav.js';
import { activeEvents, isAvailable } from '../data/availability.js';
import { RAID_STAGES } from '../data/raids.js';
import { CHARACTERS } from '../data/characters.js';
import { eventCurrencyBonusAmount } from '../data/event-drops.js';
import { openSortie } from './dungeon.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderEvent() {
  const host = $('screen-event');
  host.innerHTML = '';
  const events = activeEvents();
  if (!events.length) { host.innerHTML = '<div class="card placeholder-card">現在開催中のイベントはありません。</div>'; return; }
  events.forEach(e=>{
    const card=document.createElement('div');card.className='card';
    const stages=RAID_STAGES.filter(s=>s.event && s.eventId===e.id && isAvailable(s));
    const boosters=CHARACTERS.filter(c=>c.eventId===e.id && c.eventDropBonusChance && !c.giftOnly);
    const rates=[...new Set(boosters.map(c=>Math.round(c.eventDropBonusChance*100)))];
    card.innerHTML=`${e.banner ? `<img src="${esc(e.banner)}" alt="${esc(e.name)}" style="width:100%;border-radius:16px">` : ''}
      <h2>${esc(e.name)}</h2><p>${esc(e.description)}</p>
      <p>終了：${new Date(e.availableUntil).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間）</p>
      <p>${itemIcon(e.currency.id)} ${esc(e.currency.name)}：${state.materials[e.currency.id] || 0}</p>
      ${boosters.length ? `<p>🍬 限定ガチャ衣装の特効：自陣に編成した1人ごとに${rates.length===1 ? `${rates[0]}%` : '個別の確率'}で追加ドロップ（サポートは対象外）。</p>` : ''}
      <div class="event-stages">${stages.map(s=>`<button class="btn block mt8" data-stage="${s.id}">${esc(s.name)}<br>⚡${s.stamina} ・ ${s.floors.length}フロア ・ 🍬${s.currencyDrop?.amount || 0}個確定${boosters.length ? ` ・ 特効成功で+${eventCurrencyBonusAmount(s)}/人` : ''}${state.progress[s.id]?.normal ? ' ✓' : ''}</button>`).join('')}</div>
      <button class="btn secondary block mt8" data-shop>キャンディ交換所へ</button><button class="btn secondary block mt8" data-gacha>期間限定衣装ガチャへ</button>`;
    card.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>openSortie(stages.find(s=>String(s.id)===b.dataset.stage))));
    card.querySelector('[data-shop]').onclick=()=>showScreen('shop');
    card.querySelector('[data-gacha]').onclick=()=>showScreen('gacha');
    host.appendChild(card);
  });
}
