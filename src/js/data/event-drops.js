/** イベント交換素材の確定分に上乗せする、編成特効の抽選。 */
import { eventCatalog } from './availability.js';

export const EVENT_CURRENCY_BONUS_FRACTION = 0.2;

export function eventCurrencyBonusAmount(stage) {
  const base = Math.max(0, Math.floor(Number(stage?.currencyDrop?.amount) || 0));
  return base ? Math.max(1, Math.ceil(base * EVENT_CURRENCY_BONUS_FRACTION)) : 0;
}

export function eventCurrencyBoosters(stage, party) {
  if (!stage?.event || !stage.eventId || !stage.currencyDrop?.id) return [];
  const event = eventCatalog().find(e => e.id === stage.eventId);
  if (event?.currency?.id !== stage.currencyDrop.id) return [];
  return (party?.own || []).filter(member => member?.eventId === stage.eventId
    && !member.giftOnly && !member.raidDrop
    && Number(member.eventDropBonusChance) > 0);
}

/** サポートを含めず、自陣の特効キャラを1人ずつ独立に抽選する。 */
export function rollCurrencyDrop(stage, party, random = Math.random) {
  const id = stage?.currencyDrop?.id;
  const base = Math.max(0, Math.floor(Number(stage?.currencyDrop?.amount) || 0));
  const bonusEach = eventCurrencyBonusAmount(stage);
  let bonus = 0;
  let hits = 0;
  if (base) for (const member of eventCurrencyBoosters(stage, party)) {
    const chance = Math.max(0, Math.min(1, Number(member.eventDropBonusChance) || 0));
    if (random() < chance) { bonus += bonusEach; hits++; }
  }
  return { id, base, bonus, hits, total: base + bonus };
}
