import { registerBackHandler, showScreen, currentScreen } from '../core/nav.js';
import { COLS, ROWS, findGroups, applyGravityNoRefill } from '../battle/board.js';
import { LESSONS, lessonBoard, exerciseHole } from '../data/training.js';

const NAMES = ['火','水','木','癒','闇'];
const COLORS = ['#FF7A59','#45C8F1','#5BE08C','#FF86C8','#A76BFF'];
const KEY = 'aura-training-progress-v2';
let root, view = 'menu', lessonIndex = 0, board, original, selected = null;
let brush = 0, tool = 'paint', phase = 'edit', chain = 0, groups = [];
let practice = false, hole = null, done = new Set(), hint = false;
let deadline = 0, clock = null, timeLimit = 0, history = [];
const clone = b => b.map(row => row.slice());
function loadProgress() {
  try { const data = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(data)) done = new Set(data.filter(n => Number.isInteger(n) && n >= 0 && n < LESSONS.length)); } catch {}
}
function saveProgress() { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch {} }
function stopClock() { clearInterval(clock); clock = null; deadline = 0; }
function resetBoard() {
  stopClock(); selected = null; history = []; chain = 0; groups = []; phase = 'edit'; hint = false;
  board = clone(original);
  if (practice) board[hole[0]][hole[1]] = -1;
}
function openLesson(index, exercise = false) {
  lessonIndex = index; practice = exercise; view = 'lesson'; brush = 0; tool = 'paint';
  original = lessonBoard(LESSONS[index]);
  hole = exerciseHole(LESSONS[index]);
  resetBoard(); render();
}
function openFree() {
  view = 'free'; practice = false; tool = 'paint'; brush = 0;
  original = Array.from({length: ROWS}, () => Array(COLS).fill(-1));
  resetBoard(); render();
}
function back() {
  stopClock(); selected = null;
  if (view === 'lesson') view = 'lessons';
  else if (view === 'free' || view === 'lessons') view = 'menu';
  else { showScreen('dungeon'); return true; }
  render(); return true;
}
function button(action, text, extra = '') { return `<button class="btn" data-action="${action}" ${extra}>${text}</button>`; }
function lessonGoal(lesson) { return lesson.shape ? '基礎形' : `${lesson.goal}連鎖`; }
function practiceSuccess() {
  if (!practice) return false;
  const lesson = LESSONS[lessonIndex];
  return lesson.shape ? JSON.stringify(board) === JSON.stringify(original) : chain >= lesson.goal;
}
function message() {
  if (phase === 'finished') {
    if (view === 'free') return `${chain}連鎖でした。「配置に戻る」で直して、もう一度試せます。`;
    if (practiceSuccess()) return LESSONS[lessonIndex].shape
      ? '成功！ 連鎖を暴発させない基礎形を完成できました。ここから次の色を組み足せます。'
      : `成功！ ${chain}連鎖を作れました。次のレッスンに進めます。`;
    if (practice) return `${chain}連鎖でした。空欄の色を見直しましょう。落下後、どの色とつながるでしょうか？`;
    if (LESSONS[lessonIndex].shape) return '同色4個はまだつながっていません。連鎖を暴発させず、先へ組み足せる基礎形です。';
    return `${chain}連鎖の流れを確認できました。次は「自分で完成」で試しましょう。`;
  }
  if (phase === 'clear') return `${chain + 1}連鎖目：白い枠の${groups.map(g => NAMES[g.color]).join('・')}が消えます。${view === 'lesson' ? LESSONS[lessonIndex].tips[chain] || '' : '別々の組が同時に消えても、連鎖の段数は1段です。'}`;
  if (phase === 'fall') return '空いた場所へ上のオーラが落ちます。「落下を確認」を押して、次につながる色を見ましょう。';
  if (view === 'free') return '色を選んで配置、または「つかんで移動」でオーラを交換できます。消去判定は「連鎖を確認」または時間切れで始まります。';
  return practice ? '白い点線の空欄に入る色を選び、マスをタップ。目標の連鎖までつながるか確認しましょう。' : LESSONS[lessonIndex].intro;
}
function renderBoard() {
  const el = root.querySelector('.training-board');
  if (!el) return;
  const lit = new Set(groups.flatMap(g => g.cells.map(p => p.join(','))));
  el.innerHTML = board.flatMap((row,r) => row.map((color,c) => {
    const target = practice && hole[0]===r && hole[1]===c;
    return `<button class="training-cell ${color < 0 ? 'empty' : ''} ${lit.has(r+','+c) ? 'lit' : ''} ${target ? 'target' : ''}" data-cell="${r},${c}" style="--orb:${COLORS[color] || '#252139'}" aria-label="${r+1}行${c+1}列 ${NAMES[color] || '空き'}">${NAMES[color] || (target ? '?' : '')}</button>`;
  })).join('');
  const undo = root.querySelector('[data-action="undo"]');
  if (undo) undo.disabled = !history.length || phase !== 'edit';
}
function render() {
  let content = button('back', '‹ 戻る');
  if (view === 'menu') {
    content += `<h2>トレーニング</h2><p>スタミナ消費なし・報酬なし。何度でも連鎖を練習できます。</p><div class="stack">${button('lessons','レクチャーモード — 基本から6レッスン')}${button('free','フリーモード — 自由に配置して練習')}</div>`;
  } else if (view === 'lessons') {
    content += '<h2>連鎖レクチャー</h2><p>同色4個以上が上下左右につながると消去。落下して次の消去が起きると連鎖になります。ここでは消去数を4個に固定し、途中の補充は行いません。</p><div class="stack">';
    content += LESSONS.map((l,i) => button('lesson', `${i+1}. ${l.name} · ${lessonGoal(l)} ${done.has(i) ? '✓ 習得' : ''}`, `data-index="${i}"`)).join('') + '</div>';
  } else {
    const lesson = LESSONS[lessonIndex];
    content += `<h2>${view === 'free' ? 'フリーモード' : `${lessonIndex+1}. ${lesson.name}`}</h2>`;
    content += `<p class="training-status" role="status">${message()}</p>`;
    if (view === 'lesson') content += `<p class="training-caption">目標 ${lessonGoal(lesson)} · ${practice ? '自分で完成' : 'お手本'}${lesson.shape ? '' : ` · ${chain}連鎖まで確認`}</p>`;
    if ((practice || view === 'free') && phase === 'edit') {
      content += `<div class="training-tools">${NAMES.map((n,i)=>button('color', n, `data-color="${i}" aria-pressed="${brush===i}" style="--orb:${COLORS[i]}"`)).join('')}${view==='free' ? button('color','消す','data-color="-1"') : ''}</div>`;
      if (hint && practice) content += `<p>ヒント：ここに必要なのは「${NAMES[original[hole[0]][hole[1]]]}」。お手本で、この色が消える直前の落下を確認しましょう。</p>`;
    }
    if (view === 'free') content += `<div class="training-tools">${button('paint','配置する', `aria-pressed="${tool==='paint'}" ${phase!=='edit'?'disabled':''}`)}${button('move','つかんで移動', `aria-pressed="${tool==='move'}" ${phase!=='edit'?'disabled':''}`)}<label>操作時間 <select id="trainingTime" ${phase!=='edit'?'disabled':''}>${[0,10,15,20].map(t=>`<option value="${t}" ${timeLimit===t?'selected':''}>${t ? t+'秒' : '無制限'}</option>`).join('')}</select></label></div><p class="training-caption" id="trainingClock">${timeLimit ? '移動開始から計測（離しても継続）' : '時間無制限'}</p>`;
    content += '<div class="training-frame"><div class="training-board" aria-label="連鎖練習盤面"></div><svg class="training-fuse" viewBox="0 0 350 400" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="346" height="396" rx="8" pathLength="100"/></svg></div>';
    content += '<div class="training-tools">';
    if (phase === 'edit') content += button('step', view==='lesson'&&!practice ? (lesson.shape ? '形を確認' : 'お手本を一段ずつ見る') : (lesson.shape ? '形を判定' : '連鎖を確認'));
    if (phase === 'clear') content += button('step','光っているオーラを消す');
    if (phase === 'fall') content += button('step','落下を確認');
    content += button('reset','配置に戻る');
    if (view === 'lesson') {
      content += button(practice ? 'demo' : 'practice', practice ? 'お手本を見る' : '自分で完成');
      content += button('explore','この配置で自由練習');
      if (practice) content += button('hint','ヒント');
      if (done.has(lessonIndex) && lessonIndex<LESSONS.length-1) content += button('next','次のレッスン');
    } else {
      content += button('undo','1手戻す', history.length && phase==='edit' ? '' : 'disabled');
      content += button('blank','空の盤面') + button('random','ランダム盤面');
    }
    content += '</div><p class="training-caption">4個消し・途中の補充なし。バトルと同じ消去・落下ルールで確認します。</p>';
  }
  root.innerHTML = content;
  renderBoard();
}
function checkGroups() {
  groups = findGroups(board,4);
  phase = groups.length ? 'clear' : 'finished';
  if (phase==='finished' && view==='lesson' && practice && practiceSuccess()) { done.add(lessonIndex); saveProgress(); }
}
function step() {
  stopClock(); selected = null;
  if (phase==='edit') {
    // Free-mode snapshots make repeated experiments reversible.
    if(view==='free') original=clone(board);
    checkGroups();
  } else if (phase==='clear') {
    groups.forEach(g=>g.cells.forEach(([r,c])=>board[r][c]=-1));
    groups=[]; chain++; phase='fall';
  } else if (phase==='fall') { applyGravityNoRefill(board); checkGroups(); }
  render();
}
function startClock() {
  if (!timeLimit || clock) return;
  deadline = performance.now()+timeLimit*1000;
  clock = setInterval(()=>{
    if(currentScreen!=='training'){stopClock();selected=null;return;}
    const remain=Math.max(0,deadline-performance.now());
    const label=root.querySelector('#trainingClock'), rect=root.querySelector('.training-fuse rect');
    if(label) label.textContent=`残り ${(remain/1000).toFixed(1)}秒`;
    if(rect) {rect.style.strokeDasharray=`${remain/(timeLimit*1000)*100} 100`;rect.style.stroke=remain<=3000?'#FF705E':'#FFD278';rect.style.opacity='1';}
    if(!remain)step();
  },50);
}
function cellAt(event) {
  const el=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');
  return el && root.contains(el) ? el.dataset.cell.split(',').map(Number) : null;
}
export function renderTraining() { stopClock(); selected=null; view='menu'; render(); }
export function initTraining() {
  root=document.getElementById('screen-training'); loadProgress();
  registerBackHandler('training',back);
  document.getElementById('openTrainingBtn').addEventListener('click',()=>showScreen('training'));
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]'); if(!b||b.disabled)return;
    switch(b.dataset.action){
      case 'back':back();return;
      case 'lessons':view='lessons';break;
      case 'free':openFree();return;
      case 'lesson':openLesson(Number(b.dataset.index));return;
      case 'practice':openLesson(lessonIndex,true);return;
      case 'demo':openLesson(lessonIndex);return;
      case 'explore':original=lessonBoard(LESSONS[lessonIndex]);view='free';practice=false;tool='move';resetBoard();render();return;
      case 'next':openLesson(lessonIndex+1);return;
      case 'step':step();return;
      case 'reset':resetBoard();break;
      case 'hint':hint=true;break;
      case 'color':brush=Number(b.dataset.color);break;
      case 'paint':tool='paint';stopClock();break;
      case 'move':tool='move';break;
      case 'undo':if(history.length){board=history.pop();stopClock();}break;
      case 'blank':openFree();return;
      case 'random':openFree();board=board.map(row=>row.map(()=>Math.floor(Math.random()*5)));original=clone(board);break;
    }
    render();
  });
  root.addEventListener('change',e=>{if(e.target.id==='trainingTime'){timeLimit=Number(e.target.value);stopClock();render();}});
  root.addEventListener('pointerdown',e=>{
    if(phase!=='edit'||(view!=='free'&&!practice)||e.button>0)return;
    const p=cellAt(e);if(!p)return;
    e.preventDefault();
    if(practice) {if(p[0]===hole[0]&&p[1]===hole[1]){board[p[0]][p[1]]=brush;renderBoard();}return;}
    history.push(clone(board)); if(history.length>100)history.shift();
    if(tool==='paint'){board[p[0]][p[1]]=brush;renderBoard();return;}
    if(board[p[0]][p[1]]<0)return;
    selected=p;root.setPointerCapture(e.pointerId);startClock();
  });
  root.addEventListener('pointermove',e=>{
    if(!selected||phase!=='edit')return;
    const p=cellAt(e);if(!p)return;
    // Follow crossed cells for quick swipes, using orthogonal swaps only.
    while(selected[0]!==p[0]||selected[1]!==p[1]){
      const [r,c]=selected, nr=r+Math.sign(p[0]-r), nc=nr===r?c+Math.sign(p[1]-c):c;
      [board[r][c],board[nr][nc]]=[board[nr][nc],board[r][c]];selected=[nr,nc];
    }
    renderBoard();
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(name,()=>{selected=null;});
}
