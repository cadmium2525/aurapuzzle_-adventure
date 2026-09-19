/* 形ガードが効いているあいだ、敵の前にその形をうっすら重ねる。
   バッジは押さないと中身が読めないので、盤面を見ながら
   「どの形で消せばいいのか」を確かめられるようにするための表示。

   形は enemy-skills.js の SHAPES をそのまま使う。判定に使っている形と
   見せる形がずれると、players には直しようのない理不尽になるため。 */
import { SHAPES } from './enemy-skills.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {object} effects 敵1体ぶんの効果(defenses を見る)
 * @param {Element} root   .foe-shield の置き場
 */
export function renderEnemyShield(effects, root) {
  if (!root) return;
  const guard = effects.defenses.find(d => d.type === 'shapeGuard');
  const cells = guard && (guard.cells || SHAPES[guard.shape]);
  // 形が変わっていなければ触らない。毎フレーム作り直すと点滅の位相が戻る
  const signature = cells ? JSON.stringify(cells) : '';
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  root.replaceChildren();
  root.hidden = !cells;
  if (!cells) return;

  const rows = cells.map(c => c[0]), cols = cells.map(c => c[1]);
  const top = Math.min(...rows), left = Math.min(...cols);
  const h = Math.max(...rows) - top + 1, w = Math.max(...cols) - left + 1;
  const svg = document.createElementNS(NS, 'svg');
  // 1マス=1の座標系で描き、CSS 側で好きな大きさに引き伸ばす
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  for (const [r, c] of cells) {
    const cell = document.createElementNS(NS, 'rect');
    cell.setAttribute('x', c - left + 0.06);
    cell.setAttribute('y', r - top + 0.06);
    cell.setAttribute('width', 0.88);
    cell.setAttribute('height', 0.88);
    cell.setAttribute('rx', 0.18);
    svg.appendChild(cell);
  }
  root.appendChild(svg);
}
