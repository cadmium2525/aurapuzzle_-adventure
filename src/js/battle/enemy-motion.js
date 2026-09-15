// One short-lived canvas per sequence. Coordinates share the viewport with DOM targets.
const COLORS = ['#ff795b', '#58d7ff', '#66eca2', '#ff94d2', '#b28aff'];
const center = el => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
};
export function playEnemyMotion(events, board = []) {
  if (!events.length || document.hidden) return Promise.resolve();
  const enemy = center(document.querySelector('#enemyRoster:not([hidden]) [data-acting] .foe-art') || document.querySelector('#enemyRoster:not([hidden]) .target .foe-art') || document.getElementById('enemyEmoji'));
  const field = center(document.getElementById('board'));
  if (!enemy || !field) return Promise.resolve();
  const units = [...document.querySelectorAll('#partyRow .unit-face')].map(center);
  const canvas = document.createElement('canvas');
  canvas.className = 'enemy-motion';
  canvas.setAttribute('aria-hidden', 'true');
  const width = window.innerWidth, height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr; canvas.height = height * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return Promise.resolve(); }
  ctx.scale(dpr, dpr);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 180 : 720;
  const ring = (x,y,r) => { ctx.beginPath(); ctx.arc(x,y,Math.max(1,r),0,Math.PI*2); ctx.stroke(); };
  const text = (value,x,y,size=22) => { ctx.font = `bold ${size}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(value,x,y); };
  const line = (x,y,xx,yy) => { ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke(); };
  return new Promise(resolve => {
    const start = performance.now();
    let frame, finished = false;
    const done = () => { if (finished) return; finished=true; cancelAnimationFrame(frame); clearTimeout(timeout); canvas.remove(); resolve(); };
    // Background tabs can pause RAF. Never hold battle progression indefinitely.
    const timeout = setTimeout(done, duration + 150);
    const draw = now => {
      const t = Math.min(1,(now-start)/duration), p = reduced ? .7 : t;
      ctx.clearRect(0,0,width,height);
      for (const e of events) {
        ctx.save();
        ctx.globalAlpha = Math.min(1,t*8) * Math.min(1,(1-t)*5);
        ctx.strokeStyle = ctx.fillStyle = COLORS[e.aura] || '#deb1ff';
        ctx.lineWidth=3;
        const ex=enemy.x, ey=enemy.y;
        switch(e.type) {
          case 'bind': case 'skillDelay':
            for(const i of e.targets || []) {
              const u=units[i]; if(!u)continue;
              const travel=Math.min(1,p*1.7), x=ex+(u.x-ex)*travel, y=ey+(u.y-ey)*travel;
              if(e.type==='bind') {
                ctx.save();
                for(let k=0;k<7;k++) {
                  const px=x+Math.sin(k*2+p*8)*13,py=y+Math.cos(k*2+p*8)*11,radius=12+k;
                  const fog=ctx.createRadialGradient(px,py,0,px,py,radius);
                  fog.addColorStop(0,'#d3a0f5');fog.addColorStop(.35,'#9460bda0');fog.addColorStop(1,'#66358d00');
                  ctx.fillStyle=fog;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
                }
                ctx.fillStyle='#deb1ff';
                if(travel===1){ring(u.x,u.y,22+p*9);text('封',u.x,u.y);}
                ctx.restore();
              } else {
                ctx.strokeStyle=ctx.fillStyle='#ffba74';
                ring(x,y,17); const a=-p*Math.PI*6;
                line(x,y,x+Math.cos(a)*12,y+Math.sin(a)*12);
                if(travel===1)text(`+${e.turns}`,u.x,u.y-27);
              }
            } break;
          case 'comboGuard':
            ctx.strokeStyle='#70d9ff';
            for(let k=0;k<3;k++)ring(ex,ey,25+p*35+k*9);
            break;
          case 'shapeGuard': {
            const shapes={L:[[0,0],[1,0],[2,0],[2,1],[2,2]],cross:[[0,1],[1,0],[1,1],[1,2],[2,1]],square:[[0,0],[0,1],[1,0],[1,1]],line:[[0,0],[0,1],[0,2],[0,3]]};
            const cells=e.cells || shapes[e.shape] || shapes.square;
            const rows=cells.map(c=>c[0]),cols=cells.map(c=>c[1]);
            const midR=(Math.min(...rows)+Math.max(...rows))/2,midC=(Math.min(...cols)+Math.max(...cols))/2;
            for(const [r,c] of cells)ctx.strokeRect(ex+(c-midC)*19-7,ey+(r-midR)*19-7,14,14);
            ring(ex,ey,45+p*20);break;
          }
          case 'auraBind':
            for(let r=0;r<board.length;r++)for(let c=0;c<board[r].length;c++)if(board[r][c]===e.aura){
              const x=field.x-field.w/2+(c+.5)*field.w/7,y=field.y-field.h/2+(r+.5)*field.h/8;
              const size=8+8*(1-p);
              ring(x,y,size+5);line(x-size,y-size,x+size,y+size);line(x+size,y-size,x-size,y+size);
            }break;
          case 'timeReduce': case 'timeFixed': {
            const x=field.x,y=field.y;
            ctx.strokeStyle=ctx.fillStyle=e.type==='timeFixed'?'#85d9ff':'#ffac69';
            ring(x,y,42-(e.type==='timeReduce'?p*18:0));
            const a=e.type==='timeFixed'?-.5*Math.PI:-p*Math.PI*5;
            line(x,y,x+Math.cos(a)*27,y+Math.sin(a)*27);
            if(e.type==='timeFixed')ctx.strokeRect(x-51,y-51,102,102);
            text(`${e.type==='timeReduce'?'−':''}${e.seconds}s`,x,y+64);break;
          }
          case 'auraAbsorb':
            for(let k=0;k<12;k++){
              const a=k*Math.PI/6+p*5,r=(1-p)*110+8;
              ring(ex+Math.cos(a)*r,ey+Math.sin(a)*r,4);
            }ring(ex,ey,20+p*15);break;
          case 'buildUp':
            ctx.strokeStyle=ctx.fillStyle='#ff7755';
            for(let k=-2;k<=2;k++){const x=ex+k*16,y=ey+40-p*90;line(x,y+35,x,y);line(x-6,y+8,x,y);line(x+6,y+8,x,y);}
            break;
          case 'resolve':
            ctx.strokeStyle=ctx.fillStyle='#ffe08b';
            ctx.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=(k%2?16:38)*(1+p*.5);ctx.lineTo(ex+Math.cos(a)*r,ey+Math.sin(a)*r);}ctx.closePath();ctx.stroke();
            break;
        }
        ctx.restore();
      }
      if(t>=1)done();else frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
  });
}
