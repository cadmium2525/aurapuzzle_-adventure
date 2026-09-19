/** Acquisition flags are part of the character master, not just UI labels. */
export function acquisitionOf(character) {
  return character.raidDrop ? 'raid' : character.giftOnly ? 'gift' : 'gacha';
}
export function acquisitionFlags(mode) {
  return { raidDrop: mode === 'raid', giftOnly: mode === 'raid' || mode === 'gift' };
}
