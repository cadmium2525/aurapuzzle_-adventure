import { findGroups, applyGravityNoRefill } from '../src/js/battle/board.js';
let seed = 190714;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
function board(cols) {
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 7 }, (_, c) => cols[c][7-r] ?? -1));
}
function waves(cols) {
  const b = board(cols), result = [];
  for (;;) {
    const g = findGroups(b, 4);
    if (!g.length) return result;
    result.push(g);
    g.forEach(x => x.cells.forEach(([r,c]) => b[r][c] = -1));
    applyGravityNoRefill(b);
  }
}
// Reverse construction: insert a connected group that separates the following group.
const shapes = [ [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,1]],
  [[0,0],[1,0],[2,0],[1,1]], [[0,0],[1,0],[2,0],[3,0]] ];
for (let lesson=0; lesson<6; lesson++) {
  const target = [2,2,3,3,4,5][lesson];
  let answer;
  for (let attempt=0; attempt<10000 && !answer; attempt++) {
    let cols = Array.from({length:7},()=>[]);
    cols[2]=[target-1,target-1]; cols[3]=[target-1,target-1];
    for (let step=target-2; step>=0; step--) {
      let found;
      for(let trial=0;trial<1500;trial++) {
        const shape=step===0 && lesson===2 ? shapes[1] : shapes[random(shapes.length)], x=random(5), y=random(6);
        const cells=shape.map(([dx,dy])=>[x+dx,y+dy]);
        if(cells.some(([c,h])=>c>=7||h>=8)) continue;
        const next=cols.map(col=>col.slice());
        let valid=true;
        for(let c=0;c<7;c++) {
          const heights=cells.filter(p=>p[0]===c).map(p=>p[1]).sort((a,b)=>a-b);
          for(const h of heights) {
            if(h>next[c].length) {valid=false;break;}
            next[c].splice(h,0,step);
          }
          if(next[c].length>8) valid=false;
        }
        if(!valid)continue;
        const w=waves(next);
        if(w.length===target-step && w.every((g,i)=>g.length===1 && g[0].color===step+i)) {found=next;break;}
      }
      if(!found){cols=null;break;}
      cols=found;
    }
    if(cols) answer=cols;
  }
  if(!answer)throw new Error('No lesson '+lesson);
  console.log(JSON.stringify({lesson,columns:answer,waves:waves(answer).map(g=>g[0].cells)}));
}
