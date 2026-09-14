import test from 'node:test';
import assert from 'node:assert/strict';
import {createChanceBoard,countChanceChains,isAllClear} from '../src/js/battle/chance.js';
import {findGroups} from '../src/js/battle/board.js';
test('chance layouts start without clears and one swap produces five chains and all-clear',()=>{
  for(const min of [3,4,5,6])for(let seed=1;seed<=50;seed++){
    let n=seed;const random=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
    const {board,swap}=createChanceBoard([0,1,2,3,4],min,random);
    assert.equal(findGroups(board,min).length,0);
    assert.equal(isAllClear(board),false);
    const [[r,c],[rr,cc]]=swap;
    assert.equal(Math.abs(r-rr)+Math.abs(c-cc),1);
    [board[r][c],board[rr][cc]]=[board[rr][cc],board[r][c]];
    assert.deepEqual(countChanceChains(board,min),{chains:5,allClear:true});
  }
});
