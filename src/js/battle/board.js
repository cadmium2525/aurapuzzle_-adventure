/* =========================================================
 * board.js — 盤面データ操作(生成 / 連結判定 / 落下)
 * =======================================================*/
import { COLORS } from '../data/gamedata.js';

export const COLS = 7;
export const ROWS = 8;
/** 消滅に必要な同色連結数 */
export const MATCH_MIN = 4;

export function randColor() { return Math.floor(Math.random() * COLORS.length); }

/** 同色4つ以上の連結グループを列挙する */
export function findGroups(bd) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (bd[r][c] === -1 || visited[r][c]) continue;
    const color = bd[r][c];
    const stack = [[r, c]];
    visited[r][c] = true;
    const cells = [];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      cells.push([cr, cc]);
      for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]]) {
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (visited[nr][nc] || bd[nr][nc] !== color) continue;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    if (cells.length >= MATCH_MIN) groups.push({ cells, color });
  }
  return groups;
}

/** 消えた分だけ落下させる(補充はしない) */
export function applyGravityNoRefill(bd) {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (bd[r][c] !== -1) {
        bd[write][c] = bd[r][c];
        if (write !== r) bd[r][c] = -1;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) bd[r][c] = -1;
  }
}

/** 初期状態で消えない盤面を生成する */
export function genBoard() {
  let bd, tries = 0;
  do {
    bd = [];
    for (let r = 0; r < ROWS; r++) {
      bd.push([]);
      for (let c = 0; c < COLS; c++) {
        let color, guard = 0;
        do {
          color = randColor();
          guard++;
        } while (guard < 20 && (
          (c >= 2 && bd[r][c - 1] === color && bd[r][c - 2] === color) ||
          (r >= 2 && bd[r - 1][c] === color && bd[r - 2][c] === color)
        ));
        bd[r][c] = color;
      }
    }
    tries++;
  } while (findGroups(bd).length > 0 && tries < 30);
  return bd;
}

/** そのマスを起点にした同色連結数 */
function connectedSize(bd, r0, c0) {
  const color = bd[r0][c0];
  if (color === -1) return 0;
  const seen = new Set([r0 + ',' + c0]);
  const stack = [[r0, c0]];
  let n = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    n++;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const k = nr + ',' + nc;
      if (seen.has(k) || bd[nr][nc] !== color) continue;
      seen.add(k);
      stack.push([nr, nc]);
    }
  }
  return n;
}

/**
 * 空きマスを上から補充する。
 * 「オーラを混ぜる」ボタンを廃止したため、盤面が枯れて詰むのを防ぐ。
 * 補充直後に勝手に消えないよう、連結4以上になる色は避ける。
 * @returns {number} 補充した個数
 */
export function refillBoard(bd) {
  let filled = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (bd[r][c] !== -1) continue;
      const order = COLORS.map((_, i) => i).sort(() => Math.random() - 0.5);
      let placed = false;
      for (const color of order) {
        bd[r][c] = color;
        if (connectedSize(bd, r, c) < MATCH_MIN) { placed = true; break; }
      }
      if (!placed) bd[r][c] = order[0];
      filled++;
    }
  }
  return filled;
}
