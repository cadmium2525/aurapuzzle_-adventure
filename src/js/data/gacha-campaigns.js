import { gachaPoolAt, PICKUP_CHARACTER, PICKUP_RATE, ORB_WEIGHTS, FREPO_WEIGHTS,
  ORB_GUARANTEE_WEIGHTS, FREPO_GUARANTEE_WEIGHTS } from './gamedata.js';
import { activeEvents } from './availability.js';

export function gachaCampaignsAt(now = Date.now()) {
  const available = gachaPoolAt(now);
  const normal = available.filter(c => !c.eventId);
  const campaigns = [{ id: 'normal', name: '通常ガチャ', pool: normal,
    pickups: normal.includes(PICKUP_CHARACTER) ? [PICKUP_CHARACTER] : [], pickupRate: PICKUP_RATE }];
  for (const event of activeEvents(now)) {
    if (!event.gacha || event.gacha.enabled === false) continue;
    const limited = available.filter(c => c.eventId === event.id);
    const pickups = limited.filter(c => c.rarity === 4 && event.gacha.pickupIds?.includes(c.id));
    if (!limited.length || !pickups.length) continue;
    campaigns.push({ id: event.id, name: event.gacha.name || `${event.name}ガチャ`,
      pool: [...normal, ...limited], pickups, pickupRate: event.gacha.pickupRate ?? 0.5,
      banner: event.banner, availableUntil: event.availableUntil });
  }
  return campaigns;
}

/** 表示と実際の抽選が同じ個別提供割合を使う。 */
export function gachaRates(campaign, kind = 'orb', guaranteed = false) {
  if (!campaign || (kind === 'frepo' && campaign.id !== 'normal')) return [];
  const weights = kind === 'frepo'
    ? (guaranteed ? FREPO_GUARANTEE_WEIGHTS : FREPO_WEIGHTS)
    : (guaranteed ? ORB_GUARANTEE_WEIGHTS : ORB_WEIGHTS);
  const pool = campaign.pool.filter(c => kind !== 'frepo' || c.rarity <= 3);
  const bands = Object.entries(weights).filter(([rarity, weight]) => weight > 0 && pool.some(c => c.rarity === Number(rarity)));
  const total = bands.reduce((sum, [, weight]) => sum + weight, 0);
  return bands.flatMap(([rarity, weight]) => {
    const members = pool.filter(c => c.rarity === Number(rarity));
    const featured = members.filter(c => campaign.pickups.some(p => p.id === c.id));
    const others = members.filter(c => !featured.includes(c));
    const share = featured.length ? (others.length ? Math.max(0, Math.min(1, campaign.pickupRate)) : 1) : 0;
    return members.map(character => ({ character,
      pickup: featured.includes(character),
      rate: weight / total * (featured.includes(character) ? share / featured.length : (1 - share) / others.length)
    }));
  });
}

export function drawGacha(campaign, kind = 'orb', guaranteed = false, random = Math.random) {
  const rows = gachaRates(campaign, kind, guaranteed).filter(row => row.rate > 0);
  if (!rows.length) return null;
  let roll = random();
  for (const row of rows) { roll -= row.rate; if (roll < 0) return row.character; }
  return rows.at(-1).character;
}
