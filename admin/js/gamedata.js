/* =========================================================
 * gamedata.js — ゲーム本体のデータを読むための窓口
 *
 * 管理ツールは同じリポジトリの中にあるので、ゲームのデータ定義を
 * そのまま import する。別に写しを持つと必ずズレるため。
 * (data/ 配下は DOM に触らない純粋なデータなので、そのまま読める)
 *
 * ここから読めるのは「いま main にあるもの」。
 * 下書き(draft.js)はまだ push していないぶんなので、
 * 画面では両方を合わせて見せる。
 * =======================================================*/
export {
  AURAS, COLORS, COLOR_HEX, CHARACTERS, characterById,
  RARITY_TITLE, RARITY_HEX, ROLE_LABEL, MAX_LEVEL, MAX_GACHA_RARITY, MAX_RARITY,
  FEATURED_CHARACTER, resolveCharacter, canEvolveChar, finalStarOf
} from '../../src/js/data/characters.js';

export {
  LEADER_SKILLS, ACTIVE_SKILLS, describeLeaderSkill, describeActiveSkill
} from '../../src/js/data/skills.js';

export { ENEMIES, enemyById } from '../../src/js/data/enemies.js';

export {
  ENEMY_MASTER, ENEMY_MASTER_IDS, enemyMasterById, enemyFormOf, formCountOf, spawnEnemy
} from '../../src/js/data/enemy-master.js';

export { RAID_STAGES, KYUKO_RAID } from '../../src/js/data/raids.js';

export {
  STAGES, TECHNICAL_STAGES, DAILY_THEMES, dailyStagesFor,
  SHOP_ITEMS, GACHA_POOL, FREPO_POOL, ORB_WEIGHTS, FREPO_WEIGHTS,
  PICKUP_CHARACTER, PICKUP_RATE, ORB_COST, ORB_COST_MULTI, FREPO_COST, FREPO_COST_MULTI,
  MATERIALS, materialById, EVOLVE_COST, DISMISS_REWARD, AWAKEN_TOKEN_COST,
  HARD_REWARD_MULT, HARD_STAMINA_MULT, FLOORS_PER_STAGE,
  STAMINA_DRINK, ORB_POUCH
} from '../../src/js/data/gamedata.js';

export {
  CUSTOM_ENEMIES, CUSTOM_RAIDS, CUSTOM_CHARACTERS, CUSTOM_SETTINGS,
  CUSTOM_SKILLS, CUSTOM_LEADER_SKILLS, CUSTOM_GIFTS
} from '../../src/js/data/custom.js';

export { CHAR_ATLAS, CHAR_ATLAS_COLUMNS, CHAR_ATLAS_ROWS } from '../../src/js/data/char-atlas.js';

export { homeBanners, BANNER_INTERVAL } from '../../src/js/data/banners.js';

/* ===================== 敵の特殊行動の一覧 =====================
 * battle/enemy-skills.js が解釈できる型。新しい型を足したら
 * ここにも書き足すこと(管理ツールの入力候補になる)。
 * ===========================================================*/
export const ENEMY_EFFECTS = [
  { type: 'comboGuard', label: 'コンボガード',
    desc: '規定チェイン未満の攻撃を通さない', args: [
      { key: 'chains', label: '必要チェイン', min: 2, max: 12, def: 5 },
      { key: 'turns', label: '続くターン(空でずっと)', min: 1, max: 20, def: null }
    ] },
  { type: 'shapeGuard', label: '形ガード',
    desc: '指定の形で消さないとダメージが通らない', args: [
      { key: 'aura', label: 'オーラ', aura: true, def: 0 },
      { key: 'shape', label: '形', options: ['L', 'cross', 'square', 'line'], def: 'L' },
      { key: 'turns', label: '続くターン', min: 1, max: 20, def: 3 }
    ] },
  { type: 'auraAbsorb', label: 'オーラ吸収',
    desc: 'そのオーラの攻撃を吸収して回復する', args: [
      { key: 'aura', label: 'オーラ', aura: true, def: 0 },
      { key: 'turns', label: '続くターン', min: 1, max: 20, def: 3 }
    ] },
  { type: 'bind', label: 'バインド',
    desc: 'キャラを縛って攻撃と回復を止める', args: [
      { key: 'count', label: '人数', min: 1, max: 4, def: 1 },
      { key: 'turns', label: '続くターン', min: 1, max: 10, def: 2 }
    ] },
  { type: 'auraBind', label: 'オーラバインド',
    desc: 'そのオーラのキャラだけ攻撃できなくする', args: [
      { key: 'aura', label: 'オーラ', aura: true, def: 0 },
      { key: 'turns', label: '続くターン', min: 1, max: 10, def: 2 }
    ] },
  { type: 'skillDelay', label: 'スキル遅延',
    desc: 'スキルの再使用までを延ばす', args: [
      { key: 'count', label: '人数', min: 1, max: 4, def: 2 },
      { key: 'turns', label: '延ばすターン', min: 1, max: 10, def: 1 }
    ] },
  { type: 'timeReduce', label: '操作時間減',
    desc: 'オーラを動かせる時間を縮める', args: [
      { key: 'seconds', label: '減らす秒数', min: 1, max: 8, def: 2 },
      { key: 'turns', label: '続くターン', min: 1, max: 20, def: 3 }
    ] },
  { type: 'timeFixed', label: '操作時間固定',
    desc: '操作時間を強制的にその秒数にする', args: [
      { key: 'seconds', label: '固定する秒数', min: 1, max: 15, def: 5 },
      { key: 'turns', label: '続くターン', min: 1, max: 20, def: 3 }
    ] },
  { type: 'resolve', label: '根性',
    desc: 'HPが残っていれば一撃では倒れない', args: [
      { key: 'threshold', label: '発動するHP%', min: 1, max: 100, def: 50 }
    ] },
  { type: 'buildUp', label: 'ビルドアップ',
    desc: '次の攻撃の威力が2倍になる', args: [] },
  { type: 'summonClones', label: '分身を呼ぶ',
    desc: '身代わりの分身を出す(ボス向け)', args: [] }
];

export const ENEMY_EFFECT_BY_TYPE = Object.fromEntries(ENEMY_EFFECTS.map(e => [e.type, e]));

/** 効果1つを日本語1行にする */
export function describeEffect(effect) {
  if (!effect || !effect.type) return '';
  const def = ENEMY_EFFECT_BY_TYPE[effect.type];
  const label = def ? def.label : effect.type;
  const parts = [];
  if (effect.aura != null) parts.push(AURA_NAME[effect.aura] || `オーラ${effect.aura}`);
  if (effect.shape) parts.push(effect.shape);
  if (effect.chains != null) parts.push(`${effect.chains}チェイン`);
  if (effect.count != null) parts.push(`${effect.count}体`);
  if (effect.seconds != null) parts.push(`${effect.seconds}秒`);
  if (effect.threshold != null) parts.push(`${effect.threshold}%`);
  if (effect.turns != null) parts.push(`${effect.turns}ターン`);
  return parts.length ? `${label}(${parts.join(' / ')})` : label;
}

const AURA_NAME = ['火', '水', '木', '癒', '闇'];
export { AURA_NAME };
