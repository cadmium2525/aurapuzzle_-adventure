const COLORS = ['#ff795b', '#58d7ff', '#66eca2', '#ff94d2', '#b28aff'];

/** All attacks land together, preserving whole-turn guard/absorption/resolve rules. */
export async function playPartyAttacks(actions) {
  if (document.hidden) return;
  const enemy = (document.querySelector('#enemyRoster .target .foe-art')
    || document.querySelector('#enemyRoster .foe-art'))?.getBoundingClientRect();
  if (!enemy) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await Promise.all(actions.filter(a => a.kind === 'dmg' && a.value > 0).map(async a => {
    const source = document.querySelectorAll('#partyRow .unit-face')[a.index]?.getBoundingClientRect();
    if (!source) return;
    const x = source.left + source.width / 2, y = source.top + source.height / 2;
    const dx = enemy.left + enemy.width / 2 - x, dy = enemy.top + enemy.height / 2 - y;
    const shot = document.createElement('span');
    shot.className = 'party-projectile';
    shot.dataset.aura = a.aura;
    shot.setAttribute('aria-hidden', 'true');
    shot.style.left = `${x}px`; shot.style.top = `${y}px`;
    shot.style.setProperty('--shot-color', COLORS[a.aura]);
    document.body.appendChild(shot);
    const duration = reduced ? 120 : 460;
    const animation = shot.animate(reduced ? [
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.5)`, opacity: 1 }
    ] : [
      { transform: 'translate(0, 0) scale(.7)', opacity: 0 },
      { transform: `translate(${dx*.12}px, ${dy*.12}px) scale(1)`, opacity: 1, offset: .18 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.6)`, opacity: 1 }
    ], { duration, easing: 'ease-in', fill: 'forwards' });
    let timer;
    try {
      await Promise.race([animation.finished.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, duration + 150); })]);
    } finally { clearTimeout(timer); animation.cancel(); shot.remove(); }
  }));
}
