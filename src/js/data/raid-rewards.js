import { characterById } from './characters.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const characterLabel = id => {
  const character = characterById(id);
  return character ? `${escape(character.name)} ★${character.rarity}` : 'キャラクター';
};
const percent = rate => Math.round((rate || 0) * 100);

export function raidDropSummaryHTML(stage) {
  const floors = `全${stage.floors.length}フロア`;
  return stage.characterDrop?.id
    ? `${floors} ・ ${characterLabel(stage.characterDrop.id)} 基本${percent(stage.characterDrop.rate)}%ドロップ`
    : floors;
}

export function raidDropResultHTML(stage, droppedId, rate) {
  if (!stage.characterDrop?.id) return '';
  const result = droppedId
    ? `${characterLabel(droppedId)} ×1 獲得！`
    : `${characterLabel(stage.characterDrop.id)}のドロップなし`;
  return `${result}（確率${percent(rate)}%）`;
}
