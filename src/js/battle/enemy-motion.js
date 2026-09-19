// One short-lived canvas per sequence. Coordinates share the viewport with DOM targets.
const COLORS = ['#ff795b', '#58d7ff', '#66eca2', '#ff94d2', '#b28aff'];
const center = el => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
};
export function playEnemyMotion(events, board = []) {
  if (!events.length || document.hidden) return Promise.resolve();
  const enemy = center(document.querySelector('#enemyRoster [data-acting] .foe-art')
    || document.querySelector('#enemyRoster .target .foe-art')
    || document.querySelector('#enemyRoster .foe-art'));
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
                // 紫のモヤが敵から対象へ飛び、着いた相手を包む
                ctx.save();
                for(let k=0;k<10;k++) {
                  const px=x+Math.sin(k*1.7+p*7)*17,py=y+Math.cos(k*1.7+p*7)*15,radius=15+k*1.6;
                  const fog=ctx.createRadialGradient(px,py,0,px,py,radius);
                  fog.addColorStop(0,'#e3c0ff');fog.addColorStop(.35,'#9460bdb8');fog.addColorStop(1,'#66358d00');
                  ctx.fillStyle=fog;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
                }
                ctx.fillStyle=ctx.strokeStyle='#deb1ff';
                if(travel===1){
                  ring(u.x,u.y,24+p*10);
                  // 巻き付く鎖のつもりの短い弧
                  ctx.lineWidth=2;
                  for(let k=0;k<4;k++){
                    const a0=k*Math.PI/2+p*3;
                    ctx.beginPath();ctx.arc(u.x,u.y,30,a0,a0+.7);ctx.stroke();
                  }
                  ctx.lineWidth=3;
                  text('封',u.x,u.y);
                }
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
          /* 操作時間をいじられたことは盤面を見ても分からないので、
             盤面いっぱいの時計を魔法陣のように重ねて見せる。
             短縮は針が反時計回りに巻き戻り、固定は針が止まる。 */
          case 'timeReduce': case 'timeFixed': {
            const x=field.x,y=field.y;
            const R=Math.max(60,Math.min(field.w,field.h)*.42);
            const fixed=e.type==='timeFixed';
            ctx.strokeStyle=ctx.fillStyle=fixed?'#85d9ff':'#ffac69';
            // 外周と内周の二重円
            ctx.lineWidth=3; ring(x,y,R);
            ctx.lineWidth=1.5; ring(x,y,R*.86);
            // 文字盤の目盛り(12本)。長針の付け根に向かって伸ばす
            for(let k=0;k<12;k++){
              const a=k*Math.PI/6, inner=k%3===0?R*.70:R*.79;
              line(x+Math.cos(a)*inner,y+Math.sin(a)*inner,
                   x+Math.cos(a)*R*.86,y+Math.sin(a)*R*.86);
            }
            // 短縮は反時計回りに巻き戻す。固定は12時で止める
            const a=fixed?-.5*Math.PI:-Math.PI/2-p*Math.PI*4;
            ctx.lineWidth=4;
            line(x,y,x+Math.cos(a)*R*.62,y+Math.sin(a)*R*.62);
            ctx.lineWidth=2.5;
            const sub=a+Math.PI*.6;
            line(x,y,x+Math.cos(sub)*R*.4,y+Math.sin(sub)*R*.4);
            ring(x,y,4);
            // 巻き戻した軌跡を扇で残す(どちら回りかが一目で分かる)
            if(!fixed){
              ctx.globalAlpha*=.22; ctx.beginPath(); ctx.moveTo(x,y);
              ctx.arc(x,y,R*.62,a,-Math.PI/2); ctx.closePath(); ctx.fill();
              ctx.globalAlpha/=.22;
            }
            if(fixed)ctx.strokeRect(x-R,y-R,R*2,R*2);
            // 秒数はオーラの上に重なるので、暗い縁を付けて読めるようにする
            {
              const label=`${fixed?'':'−'}${e.seconds}s`;
              const ly=Math.min(y+R+22, field.y+field.h/2-14);
              ctx.save();
              ctx.lineWidth=5; ctx.strokeStyle='#0b0616';
              ctx.font='bold 26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
              ctx.strokeText(label,x,ly);
              ctx.restore();
              text(label,x,ly,26);
            }
            break;
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
