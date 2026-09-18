/** 敵モンスターの共通定義。idはイラストのファイル名（拡張子なし）。
 *  ステータスと行動パターンは enemy-master.js が持つ。 */
import { CUSTOM_ENEMIES } from './custom.js';

const BUILTIN = [
  { id: 'gia', name: 'ギアセンチネル', sprite: 'assets/enemy/gia.webp' },
  { id: 'gorem', name: 'ゴーレム', sprite: 'assets/enemy/gorem.webp' },
  { id: 'gost', name: 'ゴースト', sprite: 'assets/enemy/gost.webp' },
  { id: 'kongou', name: 'コンゴウ', sprite: 'assets/enemy/kongou.webp' },
  { id: 'monolith', name: 'モノリス', sprite: 'assets/enemy/monolith.webp' },
  { id: 'raiga', name: 'ボルトウルフ', sprite: 'assets/enemy/raiga.webp' },
  { id: 'worm', name: 'ワーム', sprite: 'assets/enemy/worm.webp' }
];

/* 管理者ツールで足したモンスターも、絵のあるものは同じ並びに載せる。
   ボスのように forms だけを持つものは通常の抽選に混ぜたくないので、
   sprite を持つものだけを ENEMIES に入れる。 */
const ADDED = (CUSTOM_ENEMIES || [])
  .filter(e => e && e.id && e.sprite && !BUILTIN.some(b => b.id === e.id))
  .map(e => ({ id: e.id, name: e.name || e.id, sprite: e.sprite }));

export const ENEMIES = BUILTIN.concat(ADDED);

export function enemyById(id) {
  return ENEMIES.find(enemy => enemy.id === id) || null;
}
