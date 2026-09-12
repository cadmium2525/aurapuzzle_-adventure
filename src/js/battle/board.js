/* =========================================================
 * board.js — 盤面データ操作(生成 / 連結判定 / 落下 / 補充 / 変換)
 * 消滅に必要な連結数(min)はリーダースキルで緩和されることがあるため、
 * どの関数も外から受け取れるようにしている。
 * =======================================================*/
import { COLORS, MATCH_MIN_DEFAULT } from '../data/gamedata.js';

export const COLS = 7;
export const ROWS = 8;
export const MATCH_MIN = MATCH_MIN_DEFAULT;

export function randColor() { return Math.floor(Math.random() * COLORS.length); }

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** 同オーラが min 個以上つながっているグループを列挙する */
export function findGroups(bd, min = MATCH_MIN) {
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
      for (const [dr, dc] of NEIGHBORS) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (visited[nr][nc] || bd[nr][nc] !== color) continue;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    if (cells.length >= min) groups.push({ cells, color });
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

/** そのマスを起点にした同オーラの連結数 */
function connectedSize(bd, r0, c0) {
  const color = bd[r0][c0];
  if (color === -1) return 0;
  const seen = new Set([r0 + ',' + c0]);
  const stack = [[r0, c0]];
  let n = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    n++;
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const k = nr + ',' + nc;
      if (seen.has(k) || bd[nr][nc] !== color) continue;
      seen.add(k);
      stack.push([nr, nc]);
    }
  }
  return n;
}

/** 初期状態で消えない盤面を生成する */
export function genBoard(min = MATCH_MIN) {
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
          (c >= min - 2 && bd[r].slice(c - (min - 2), c).every(v => v === color)) ||
          (r >= min - 2 && Array.from({ length: min - 2 }, (_, k) => bd[r - 1 - k][c]).every(v => v === color))
        ));
        bd[r][c] = color;
      }
    }
    tries++;
  } while (findGroups(bd, min).length > 0 && tries < 30);
  return bd;
}

/**
 * 空きマスを補充する。補充直後に勝手に消えないよう、
 * min 個以上の連結になる色は避ける。
 * @returns {number} 補充した個数
 */
export function refillBoard(bd, min = MATCH_MIN) {
  let filled = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (bd[r][c] !== -1) continue;
      const order = COLORS.map((_, i) => i).sort(() => Math.random() - 0.5);
      let placed = false;
      for (const color of order) {
        bd[r][c] = color;
        if (connectedSize(bd, r, c) < min) { placed = true; break; }
      }
      if (!placed) bd[r][c] = order[0];
      filled++;
    }
  }
  return filled;
}

/* ===================== スキルによる盤面操作 ===================== */

/**
 * 指定オーラをすべて別のオーラへ変換する。
 * @returns {Array<[number,number]>} 変換したマス
 */
export function convertColor(bd, from, to) {
  const changed = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (bd[r][c] === from) { bd[r][c] = to; changed.push([r, c]); }
  }
  return changed;
}

/**
 * ランダムなマスを指定オーラへ変換する(すでにそのオーラのマスは対象外)。
 * @returns {Array<[number,number]>} 変換したマス
 */
export function spawnColor(bd, to, count) {
  const cands = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (bd[r][c] !== -1 && bd[r][c] !== to) cands.push([r, c]);
  }
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  const picked = cands.slice(0, count);
  picked.forEach(([r, c]) => { bd[r][c] = to; });
  return picked;
}

/** 盤面のオーラをシャッフルする(枚数は変えずに並べ替える) */
export function shuffleBoard(bd) {
  const vals = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (bd[r][c] !== -1) vals.push(bd[r][c]);
  }
  for (let i = vals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  let k = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (bd[r][c] !== -1) bd[r][c] = vals[k++];
  }
}
