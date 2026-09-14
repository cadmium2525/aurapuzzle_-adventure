import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, lessonBoard, simulateTraining, exerciseHole } from '../src/js/data/training.js';
import { findGroups } from '../src/js/battle/board.js';

for (const lesson of LESSONS) test(`${lesson.name}: submitted board and repair exercise`, () => {
  const board = lessonBoard(lesson), before = JSON.stringify(board);
  const result = simulateTraining(board);
  assert.equal(result.waves.length, lesson.goal);
  assert.equal(JSON.stringify(board), before);
  assert.ok(result.waves.every(w => w.length === 1 && w[0].cells.length === 4));
  const [r,c] = exerciseHole(lesson);
  const correct = board[r][c];
  board[r][c] = -1;
  if (lesson.shape) assert.notEqual(JSON.stringify(board), before);
  else assert.ok(simulateTraining(board).waves.length < lesson.goal);
  for(let color=0;color<5;color++) {
    if(color===correct)continue;
    board[r][c]=color;
    if (lesson.shape) assert.notEqual(JSON.stringify(board), before);
    else assert.ok(simulateTraining(board).waves.length < lesson.goal);
  }
  board[r][c]=correct;
  assert.equal(simulateTraining(board).waves.length,lesson.goal);
  assert.equal(JSON.stringify(board),before);
});

test('simultaneous clears count as one wave and diagonal contact does not clear',()=>{
  const board = Array.from({length:8},()=>Array(7).fill(-1));
  for(let r=4;r<8;r++){board[r][0]=0;board[r][6]=1;}
  assert.equal(simulateTraining(board).waves.length,1);
  const diagonal=Array.from({length:8},()=>Array(7).fill(-1));
  for(let i=0;i<4;i++)diagonal[i+4][i]=0;
  assert.equal(simulateTraining(diagonal).waves.length,0);
});
