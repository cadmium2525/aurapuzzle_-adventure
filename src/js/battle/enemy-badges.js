const ORDER = ['buildUp', 'resolve', 'auraAbsorb', 'comboGuard', 'shapeGuard'];
const AURAS = ['火', '水', '木', '癒', '闇'];
const COLORS = ['#ff795b','#58d7ff','#66eca2','#ff94d2','#b28aff'];

/** 既定の置き場は「いま狙っている敵」のバッジ欄。敵ごとに描くときは root を渡す。 */
const targetBadgeBox = () =>
  document.querySelector('#enemyRoster .foe.target .foe-badges')
  || document.querySelector('#enemyRoster .foe-badges');

export function renderEnemyBadges(effects, root = targetBadgeBox()) {
  if (!root) return;
  const badges = effects.defenses.map(e => ({ ...e }));
  if (effects.attackMult > 1) badges.push({type:'buildUp'});
  if (effects.resolve?.active) badges.push({type:'resolve',threshold:effects.resolve.threshold});
  const signature = JSON.stringify(badges);
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  root.replaceChildren();
  for (const e of badges) {
    const index = ORDER.indexOf(e.type);
    if (index < 0) continue;
    let description;
    if (e.type === 'buildUp') description = 'ビルドアップ：敵の攻撃力が2倍';
    if (e.type === 'resolve') description = `根性：致死ダメージをHP1で耐える。HP${e.threshold}%以下で解除`;
    if (e.type === 'auraAbsorb') description = `オーラ吸収：${AURAS[e.aura]}のダメージを吸収して回復`;
    if (e.type === 'comboGuard') description = `コンボガード：${e.chains}チェイン以下のダメージを無効化`;
    if (e.type === 'shapeGuard') description = `形状指定：${e.label || e.shape || '指定の形'}で消さないとダメージ無効（オーラは問わない）`;
    if (Number.isFinite(e.turns)) description += `（残り${e.turns}ターン）`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'enemy-badge';
    button.dataset.effect = e.type;
    button.style.setProperty('--badge-index',index);
    button.title = description;
    button.setAttribute('aria-label',description);
    const art = document.createElement('span');
    art.className = 'enemy-badge-art';
    art.setAttribute('aria-hidden','true');
    button.appendChild(art);
    // 形ガードはオーラを問わない。古いデータに aura が残っていても札は出さない
    if (e.aura !== undefined && e.type !== 'shapeGuard') {
      const aura = document.createElement('span');
      aura.className = 'enemy-badge-aura';
      aura.style.background = COLORS[e.aura];
      aura.textContent = AURAS[e.aura];
      button.appendChild(aura);
    }
    if (Number.isFinite(e.turns)) {
      const turns = document.createElement('span');
      turns.className = 'enemy-badge-turns';
      turns.textContent = e.turns;
      button.appendChild(turns);
    }
    button.addEventListener('click', async () => {
      const { toast } = await import('../core/ui.js');
      toast(description);
    });
    root.appendChild(button);
  }
}
