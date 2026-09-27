import { COLS, ROWS, shuffleBoard, spawnColor } from './board.js';

/** Immediate enemy board actions keep the same grid and reuse skill conversion visuals. */
export function applyBoardDisruption(board, effect) {
  if (!board) return [];
  const before = board.map(row => row.slice());
  if (effect.type === 'boardShuffle') shuffleBoard(board);
  else if (effect.type === 'auraCorrupt') {
    const aura = Number(effect.aura);
    if (Number.isInteger(aura) && aura >= 0 && aura <= 4)
      spawnColor(board, aura, Math.min(COLS * ROWS, Math.max(0, Math.floor(Number(effect.count) || 0))));
  }
  const changed = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (before[r]?.[c] !== board[r]?.[c]) changed.push([r, c]);
  return changed;
}
