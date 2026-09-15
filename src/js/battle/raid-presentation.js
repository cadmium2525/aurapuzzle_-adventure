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
  box.textContent=`${name}「${line}」`;box.hidden=false;
  await pause(Math.min(2800,Math.max(1400,line.length*48)));
  box.hidden=true;
}
