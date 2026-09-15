const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export async function bossTransition(kind) {
  const layer=document.createElement('div');layer.className=`boss-transition ${kind}`;
  layer.setAttribute('role','status');
  layer.textContent=kind==='warning'?'強大な妖気が迫る…… 九狐、出現！':'';
  document.body.appendChild(layer);
  await pause(1000);
  return async()=>{layer.classList.add('leaving');await pause(650);layer.remove();};
}

/** 立ち絵のパスから顔アイコン版(`〜_icon.webp`)を組み立てる */
const faceVariant = src => src.replace(/(\.[a-z0-9]+)$/i,'_icon$1');

/** 盤面に出ている敵の画像から、セリフ用の顔アイコンを作る */
function buildFace(sprite) {
  const src = sprite
    || document.querySelector('.foe[data-acting] .foe-art img, .foe.target .foe-art img, #enemyEmoji img')
      ?.getAttribute('src');
  if(!src)return null;
  const face=document.createElement('img');
  face.className='dialogue-face';face.alt='';
  // 顔アイコンが無ければ立ち絵、それも読めなければ顔なしで表示する
  let fellBack=false;
  face.addEventListener('error',()=>{
    if(fellBack){face.remove();return;}
    fellBack=true;face.src=src;
  });
  face.src=faceVariant(src);
  return face;
}

/**
 * 敵のセリフ。画面全体を覆わず、盤面の手前に出るセリフ帯だけのモーダルにする。
 * キュウコと戦況を見せたままセリフを読ませたいので、背景は軽く落とすだけ。
 *
 * 文字は1文字ずつ出るが、未表示ぶんも `visibility:hidden` で場所を取らせているので
 * 行数は最初から確定していて箱がガタつかない。全文は最初からDOMにあるため、
 * 読み上げや自動テストからも最初から全文が読める。
 *
 * タップ1回目で全文を即表示、2回目で次へ。放っておいても自動で進む。
 */
export async function bossDialogue(name, line, sprite) {
  const box=document.getElementById('bossDialogue');
  box.replaceChildren();

  const shell=document.createElement('div');shell.className='dialogue-box';
  const face=buildFace(sprite);
  if(face)shell.appendChild(face);

  const body=document.createElement('div');body.className='dialogue-body';
  const speaker=document.createElement('b');speaker.className='dialogue-name';speaker.textContent=name;
  const text=document.createElement('p');text.className='dialogue-text';
  const shown=document.createElement('span');
  const rest=document.createElement('span');rest.className='dialogue-rest';rest.textContent=line;
  text.append(shown,rest);
  const foot=document.createElement('div');foot.className='dialogue-foot';
  const hint=document.createElement('small');hint.textContent='タップで送る';
  const next=document.createElement('button');next.type='button';next.className='dialogue-next';next.textContent='次へ ›';
  foot.append(hint,next);
  body.append(speaker,text,foot);
  shell.appendChild(body);
  box.appendChild(shell);

  const instant=reducedMotion();
  let typed=false;
  const revealAll=()=>{shown.textContent=line;rest.textContent='';typed=true;shell.classList.add('ready');};

  const previous=document.activeElement;
  let advance;
  const tapped=new Promise(resolve=>{advance=resolve;});
  const onTap=()=>{if(typed)advance();else revealAll();};
  const cancel=e=>{e.preventDefault();advance();};
  box.addEventListener('click',onTap);box.addEventListener('cancel',cancel);
  box.showModal();next.focus({preventScroll:true});

  try {
    if(instant)revealAll();
    else {
      const speed=Math.min(34,2000/Math.max(1,line.length));
      for(let i=1;i<=line.length&&!typed;i++){
        shown.textContent=line.slice(0,i);rest.textContent=line.slice(i);
        await pause(speed);
      }
      if(!typed)revealAll();
    }
    await Promise.race([tapped,pause(Math.min(3000,Math.max(1400,line.length*45)))]);
  } finally {
    box.close();box.removeEventListener('click',onTap);box.removeEventListener('cancel',cancel);
    if(previous?.isConnected)previous.focus({preventScroll:true});
  }
}
