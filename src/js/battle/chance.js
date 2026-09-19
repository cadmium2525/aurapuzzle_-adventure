import { COLS, ROWS, findGroups, applyGravityNoRefill, connectedSize } from './board.js';

export const isAllClear = board => board.every(row => row.every(color => color === -1));

/** 梯子が約束する連鎖数。これに届かない埋め方は捨てる */
const LADDER_CHAINS = 5;

const shuffle = (list, random) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

/**
 * 5連鎖ぶんの梯子だけを置いた盤面。上のほうは空いたまま。
 * 下から積み上げ、各列の一番上のオーラが、下が消えたあとに
 * 隣の列へ落ちて次の塊になる — という繰り返しで連鎖する。
 */
function buildLadder(colors, min, random) {
  const order = shuffle(colors.slice(), random);
  const repeat = color => Array(min - 1).fill(color);
  const columns = [[], repeat(order[0]), [...repeat(order[1]), order[0]],
    [...repeat(order[2]), order[1]], [...repeat(order[0]), order[2]],
    [...repeat(order[3]), order[0]], [order[3]]];
  if (random() < .5) columns.reverse();
  return Array.from({ length: ROWS },
    (_, r) => Array.from({ length: COLS }, (_, c) => columns[c][ROWS - 1 - r] ?? -1));
}

/**
 * 梯子の周りの空きマスを埋める。置いた瞬間に消えない色だけを選ぶので、
 * 埋めても梯子の塊(1波目)以外の塊はできない。
 * @returns {boolean} 全部置けたか。色が足りず詰んだら false
 */
function fillRest(bd, colors, min, random) {
  for (let c = 0; c < COLS; c++) for (let r = ROWS - 1; r >= 0; r--) {
    if (bd[r][c] !== -1) continue;
    let placed = false;
    for (const color of shuffle(colors.slice(), random)) {
      bd[r][c] = color;
      if (connectedSize(bd, r, c) < min) { placed = true; break; }
    }
    if (!placed) { bd[r][c] = -1; return false; }
  }
  return true;
}

/** 塊が消えるように1手だけ崩す。その1手を戻せば梯子が走り出す */
function breakOptions(solved, min) {
  const options = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[1,0],[0,1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= ROWS || nc >= COLS || solved[r][c] === solved[nr][nc]) continue;
    const board = solved.map(row => row.slice());
    [board[r][c], board[nr][nc]] = [board[nr][nc], board[r][c]];
    if (!findGroups(board, min).length) options.push({ board, swap: [[r,c],[nr,nc]] });
  }
  return options;
}

/**
 * チャンス盤面。1手戻すだけで5連鎖以上が走る、**隙間のない**盤面を返す。
 *
 * 盤面を埋めてあるのは2つの理由から。
 *   ・空きだらけだと5連鎖で打ち止めになる。埋めておけば、梯子に
 *     自分で組んだぶんを足して伸ばせる(実測で6〜9連鎖まで伸びる)。
 *   ・空きだらけの梯子は消えると盤面が空になり、そのまま次の全消し
 *     ボーナスを呼ぶ。埋めたぶんが残るので、このループが切れる。
 *
 * 埋めると梯子が崩れて5連鎖に届かないことがあるので、実際に走らせて
 * 確かめ、届かない埋め方は捨てる(平均1.3回、最大5回で通る)。
 */
export function createChanceBoard(auras = [0,1,2,3], min = 4, random = Math.random) {
  const colors = [...new Set(auras)];
  if (colors.length < 4 || min < 3 || min > 6) throw new Error('Chance board requires four auras and a match minimum of 3–6');
  for (let attempt = 0; attempt < 60; attempt++) {
    const solved = buildLadder(colors, min, random);
    if (!fillRest(solved, colors, min, random)) continue;
    const run = countChanceChains(solved, min);
    if (run.chains < LADDER_CHAINS || run.allClear) continue;
    const options = breakOptions(solved, min);
    if (options.length) return options[Math.floor(random() * options.length)];
  }
  throw new Error('No playable chance layout');
}

export function countChanceChains(input,min=4) {
  const board=input.map(row=>row.slice());let chains=0;
  for(;;){const groups=findGroups(board,min);if(!groups.length)return {chains,allClear:isAllClear(board)};
    chains++;for(const g of groups)for(const [r,c] of g.cells)board[r][c]=-1;
    applyGravityNoRefill(board);
  }
}
