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
  { id: 'worm', name: 'ワーム', sprite: 'assets/enemy/worm.webp' },
  { id: 'glyphowl', name: '符紋梟グリフ', sprite: 'assets/enemy/glyphowl.webp' },
  { id: 'umbrastag', name: '影角鹿ウンブラ', sprite: 'assets/enemy/umbrastag.webp' },
  { id: 'chronosnail', name: '時砂の巻貝クロノ', sprite: 'assets/enemy/chronosnail.webp' },
  { id: 'mirrorjelly', name: '鏡海月ミラージュ', sprite: 'assets/enemy/mirrorjelly.webp' },
  { id: 'arcanacauldron', name: '魔薬釜アルカナ', sprite: 'assets/enemy/arcanacauldron.webp' },
  { id: 'arcanacauldron_fire', name: '紅炎のアルカナ', sprite: 'assets/enemy/arcanacauldron_fire.webp' },
  { id: 'arcanacauldron_wood', name: '翠森のアルカナ', sprite: 'assets/enemy/arcanacauldron_wood.webp' },
  { id: 'arcanacauldron_heal', name: '聖花のアルカナ', sprite: 'assets/enemy/arcanacauldron_heal.webp' }
];

/* ENEMIES はノーマルダンジョンの自動抽選だけに使う。
   既存IDを管理者ツールで編集した場合も、名前・画像・ボス分類を反映する。
   テクニカル・曜日・降臨・イベントは専用の出現表または明示フロアを使う。 */
export function buildEnemyPool(builtins, additions) {
  const customById = new Map((additions || []).filter(e => e && e.id).map(e => [e.id, e]));
  const visible = builtins.flatMap(base => {
    const override = customById.get(base.id);
    // forms は boss 属性導入前のデータを守る互換判定
    if (override?.boss || override?.forms) return [];
    return [{ id: base.id, name: override?.name || base.name, sprite: override?.sprite || base.sprite }];
  });
  const builtinIds = new Set(builtins.map(e => e.id));
  for (const enemy of customById.values()) {
    if (builtinIds.has(enemy.id) || !enemy.sprite || enemy.boss || enemy.forms) continue;
    visible.push({ id: enemy.id, name: enemy.name || enemy.id, sprite: enemy.sprite });
  }
  return visible;
}

export const ENEMIES = buildEnemyPool(BUILTIN, CUSTOM_ENEMIES);

export function enemyById(id) {
  return ENEMIES.find(enemy => enemy.id === id) || null;
}
