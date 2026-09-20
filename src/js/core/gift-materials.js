import { MATERIALS, materialById } from '../data/gamedata.js';

/** プレゼント内の素材を、ゲームが知っているIDと正の整数だけに整える。 */
export function giftMaterials(gift) {
  const source = gift?.materials || {};
  const result = {};
  for (const material of MATERIALS) {
    const amount = Math.max(0, Math.floor(Number(source[material.id]) || 0));
    if (amount) result[material.id] = amount;
  }
  return result;
}

export function materialRewardText(gift) {
  return Object.entries(giftMaterials(gift)).map(([id, amount]) => {
    const material = materialById(id);
    return `${material.emoji}${material.name}×${amount}`;
  }).join(' ');
}

export function addGiftMaterialTotals(total, gift) {
  if (!total.materials) total.materials = {};
  for (const [id, amount] of Object.entries(giftMaterials(gift))) {
    total.materials[id] = (total.materials[id] || 0) + amount;
  }
  return total;
}
