import { COLS, ROWS, findGroups, applyGravityNoRefill } from './board.js';

export const isAllClear = board => board.every(row => row.every(color => color === -1));

/** A shuffled-color five-wave ladder with one adjacent swap left to complete. */
export function createChanceBoard(auras = [0,1,2,3], min = 4, random = Math.random) {
  const colors = [...new Set(auras)];
  if (colors.length < 4 || min < 3 || min > 6) throw new Error('Chance board requires four auras and a match minimum of 3–6');
  for (let i=colors.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1)); [colors[i],colors[j]]=[colors[j],colors[i]];
  }
  const repeat = color => Array(min-1).fill(color);
  const columns = [[],repeat(colors[0]),[...repeat(colors[1]),colors[0]],
    [...repeat(colors[2]),colors[1]],[...repeat(colors[0]),colors[2]],
    [...repeat(colors[3]),colors[0]],[colors[3]]];
  const mirror = random() < .5;
  if(mirror)columns.reverse();
  const solved = Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>columns[c][ROWS-1-r]??-1));
  const options=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)for(const [dr,dc] of [[1,0],[0,1]]) {
    const nr=r+dr,nc=c+dc;
    if(nr>=ROWS||nc>=COLS||solved[r][c]<0||solved[nr][nc]<0||solved[r][c]===solved[nr][nc])continue;
    const board=solved.map(row=>row.slice());
    [board[r][c],board[nr][nc]]=[board[nr][nc],board[r][c]];
    if(!findGroups(board,min).length)options.push({board,swap:[[r,c],[nr,nc]]});
  }
  if(!options.length)throw new Error('No playable chance layout');
  return options[Math.floor(random()*options.length)];
}

export function countChanceChains(input,min=4) {
  const board=input.map(row=>row.slice());let chains=0;
  for(;;){const groups=findGroups(board,min);if(!groups.length)return {chains,allClear:isAllClear(board)};
    chains++;for(const g of groups)for(const [r,c] of g.cells)board[r][c]=-1;
    applyGravityNoRefill(board);
  }
}
