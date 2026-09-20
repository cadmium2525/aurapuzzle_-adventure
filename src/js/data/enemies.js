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

/* 管理者ツールで足した通常モンスターも、絵のあるものは同じ並びに載せる。
   ENEMIES はノーマル・テクニカル・曜日ダンジョンの自動抽選に使われるため、
   ボスは必ず除外する。forms は boss 属性導入前のデータを守る互換判定。 */
const ADDED = (CUSTOM_ENEMIES || [])
  .filter(e => e && e.id && e.sprite && !e.boss && !e.forms
    && !BUILTIN.some(b => b.id === e.id))
  .map(e => ({ id: e.id, name: e.name || e.id, sprite: e.sprite }));

export const ENEMIES = BUILTIN.concat(ADDED);

export function enemyById(id) {
  return ENEMIES.find(enemy => enemy.id === id) || null;
}
