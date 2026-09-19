import test from 'node:test';
import assert from 'node:assert/strict';
import {createChanceBoard,countChanceChains,isAllClear} from '../src/js/battle/chance.js';
import {findGroups,ROWS,COLS} from '../src/js/battle/board.js';

test('chance layouts are full, start without clears and one swap runs at least five chains',()=>{
  for(const auras of [[0,1,2,3],[0,1,2,3,4]])for(const min of [3,4,5,6])for(let seed=1;seed<=50;seed++){
    let n=seed;const random=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
    const {board,swap}=createChanceBoard(auras,min,random);
    const where=`auras${auras.length} min${min} seed${seed}`;
    // 盤面は隙間なく埋まっていること。空きだらけだと5連鎖で打ち止めになるうえ、
    // 消えたあと盤面が空になって次の全消しボーナスを呼んでしまう
    assert.equal(board.length,ROWS,where);
    board.forEach(row=>{
      assert.equal(row.length,COLS,where);
      row.forEach(color=>assert.ok(color>=0,`空きマスが残っている ${where}`));
    });
    board.forEach(row=>row.forEach(color=>assert.ok(auras.includes(color),`盤面にない色 ${where}`)));
    assert.equal(findGroups(board,min).length,0,`配られた時点で消える ${where}`);
    assert.equal(isAllClear(board),false,where);
    const [[r,c],[rr,cc]]=swap;
    assert.equal(Math.abs(r-rr)+Math.abs(c-cc),1,`入れ替えが隣り合っていない ${where}`);
    [board[r][c],board[rr][cc]]=[board[rr][cc],board[r][c]];
    const run=countChanceChains(board,min);
    assert.ok(run.chains>=5,`5連鎖に届かない(${run.chains}) ${where}`);
    // 全消しで終わると、そのまま次のチャンス盤面を呼んで無限に続いてしまう
    assert.equal(run.allClear,false,`全消しで終わっている ${where}`);
  }
});
