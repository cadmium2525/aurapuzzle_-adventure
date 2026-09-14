/** 敵モンスターの共通定義。idはイラストのファイル名（拡張子なし）。 */
export const ENEMIES = [
  { id: 'gia', name: 'ギアセンチネル', sprite: 'assets/enemy/gia.webp' },
  { id: 'gorem', name: 'ゴーレム', sprite: 'assets/enemy/gorem.webp' },
  { id: 'gost', name: 'ゴースト', sprite: 'assets/enemy/gost.webp' },
  { id: 'kongou', name: 'コンゴウ', sprite: 'assets/enemy/kongou.webp' },
  { id: 'monolith', name: 'モノリス', sprite: 'assets/enemy/monolith.webp' },
  { id: 'raiga', name: 'ボルトウルフ', sprite: 'assets/enemy/raiga.webp' },
  { id: 'worm', name: 'ワーム', sprite: 'assets/enemy/worm.webp' }
];

export function enemyById(id) {
  return ENEMIES.find(enemy => enemy.id === id) || null;
}
