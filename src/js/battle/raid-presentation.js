const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
export async function bossTransition(kind) {
  const layer=document.createElement('div');layer.className=`boss-transition ${kind}`;
  layer.setAttribute('role','status');
  layer.textContent=kind==='warning'?'強大な妖気が迫る…… 九狐、出現！':'';
  document.body.appendChild(layer);
  await pause(1000);
  return async()=>{layer.classList.add('leaving');await pause(650);layer.remove();};
}
export async function bossDialogue(name,line) {
  const box=document.getElementById('bossDialogue');
  box.replaceChildren();
  const portrait=document.querySelector('.foe[data-acting] .foe-art img')
    || document.querySelector('.foe.target .foe-art img, #enemyEmoji img');
  if(portrait){const art=portrait.cloneNode();art.className='dialogue-portrait';art.alt='';box.appendChild(art);}
  const panel=document.createElement('div');panel.className='dialogue-panel';
  const speaker=document.createElement('b');speaker.textContent=name;
  const text=document.createElement('p');text.textContent=line;
  const next=document.createElement('button');next.type='button';next.textContent='次へ ›';
  const hint=document.createElement('small');hint.textContent='自動進行・タップで次へ';
  panel.append(speaker,text,next,hint);box.appendChild(panel);
  const previous=document.activeElement;
  let advance;
  const tapped=new Promise(resolve=>{advance=resolve;});
  const cancel=e=>{e.preventDefault();advance();};
  box.addEventListener('click',advance);box.addEventListener('cancel',cancel);
  box.showModal();next.focus({preventScroll:true});
  try { await Promise.race([tapped,pause(Math.min(4800,Math.max(2400,line.length*80)))]); }
  finally {
    box.close();box.removeEventListener('click',advance);box.removeEventListener('cancel',cancel);
    if(previous?.isConnected)previous.focus({preventScroll:true});
  }
}
