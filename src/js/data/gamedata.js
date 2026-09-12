/* =========================================================
 * gamedata.js — 静的ゲームデータのハブ
 * オーラ/キャラクターは characters.js、スキルは skills.js に定義し、
 * ここではステージ・ショップ・ガチャ・各種定数をまとめる。
 * =======================================================*/
export * from './characters.js';
export * from './skills.js';

import { CHARACTERS, MAX_GACHA_RARITY, FEATURED_CHARACTER } from './characters.js';

/* --- 編成は自分3人 + サポート1人(フレンド or NPC)の計4人 --- */
export const TEAM_SIZE = 3;
export const SUPPORT_SLOT = 1;

/* ===================== バトル定数 ===================== */
/** オーラ操作の基本時間(ms)。リーダースキル/スキルで延長できる */
export const BASE_DRAG_TIME = 10000;
/** 操作時間の上限(ms)。延長を盛っても青天井にはしない */
export const MAX_DRAG_TIME = 40000;
/** 攻撃力 → ダメージへの換算係数 */
export const ATTACK_SCALE = 3.0;
/** 回復力 → 回復量への換算係数 */
export const HEAL_SCALE = 2.4;
/** 最低連結数を1個超えるごとの威力上昇 */
export const ORB_BONUS = 0.35;
/** コンボごとの倍率上昇 */
export const COMBO_BONUS = 0.6;
/** 同時消し1グループごとの倍率上昇 */
export const SIMUL_BONUS = 0.05;
/** パーティの基礎HP(キャラのHP合計に加算) */
export const BASE_PARTY_HP = 100;
/** 消滅に必要な同オーラの連結数(リーダースキルで緩和されることがある) */
export const MATCH_MIN_DEFAULT = 4;

/* ===================== ステージ ===================== */
const ENEMY_EMOJIS = ['👹','🐉','👻','🧟','🦂','🕷️','🐍','💀','🦑','👺','🐺','🦁','🐲','🧌','👽'];
export const FLOORS_PER_STAGE = 5;

const STAGE_NAMES = [
  '始まりの街道', '霧ふる湖畔', '灼熱の峡谷', '常闇の樹海', '天空回廊'
];
/** ステージごとに主に落ちる結晶のオーラ */
const STAGE_AURA = [0, 1, 0, 2, 3];

export const STAGES = (() => {
  const list = [];
  for (let s = 1; s <= 5; s++) {
    const floors = [];
    for (let f = 1; f <= FLOORS_PER_STAGE; f++) {
      const isBoss = f === FLOORS_PER_STAGE;
      floors.push({
        name: isBoss ? `${STAGE_NAMES[s - 1]}の主` : `フロア${f}`,
        emoji: ENEMY_EMOJIS[(s * 5 + f) % ENEMY_EMOJIS.length],
        hp: Math.round((120 + (s - 1) * 260 + (f - 1) * 60) * (isBoss ? 1.6 : 1)),
        atk: 8 + (s - 1) * 10 + (f - 1) * 3,
        interval: isBoss ? 1 : 2   // 何ターンごとに攻撃してくるか
      });
    }
    list.push({
      id: s,
      name: `${s}. ${STAGE_NAMES[s - 1]}`,
      floors,
      stamina: 5 + (s - 1) * 3,
      coinReward: 150 * s,
      frepoReward: 80 * s,
      orbReward: s >= 3 ? 2 : 0,
      expReward: 25 * s,
      charExpReward: 80 + 130 * (s - 1),  // 編成キャラが得る経験値
      dropAura: STAGE_AURA[s - 1],        // 主に落ちる結晶のオーラ
      shardRate: 0.18 + 0.18 * (s - 1)    // 進化の輝石が落ちる確率
    });
  }
  return list;
})();

export const HARD_HP_MULT = 1.8;
export const HARD_REWARD_MULT = 1.6;
export const HARD_STAMINA_MULT = 1.5;

/* ===================== 進化素材 ===================== */
/** オーラ別の結晶 + 全キャラ共通の輝石 */
export const MATERIALS = [
  { id: 'mt_c0',   name: '紅蓮の結晶', emoji: '🔴', aura: 0,    color: '#FF7A59' },
  { id: 'mt_c1',   name: '蒼海の結晶', emoji: '🔵', aura: 1,    color: '#45C8F1' },
  { id: 'mt_c2',   name: '翠緑の結晶', emoji: '🟢', aura: 2,    color: '#5BE08C' },
  { id: 'mt_c3',   name: '聖光の結晶', emoji: '🩷', aura: 3,    color: '#FF86C8' },
  { id: 'mt_star', name: '進化の輝石', emoji: '💠', aura: null, color: '#FFC65C' }
];
const MATERIAL_BY_ID = new Map(MATERIALS.map(m => [m.id, m]));
export function materialById(id) { return MATERIAL_BY_ID.get(id) || null; }
/** そのオーラの結晶ID */
export function crystalIdFor(aura) { return `mt_c${aura}`; }

/**
 * 進化に必要なもの。★N へ上がるときのコスト。
 * 結晶はキャラ自身のオーラのものを使う。
 */
export const EVOLVE_COST = {
  2: { crystal: 3,  shard: 1,  coin: 1000 },
  3: { crystal: 6,  shard: 2,  coin: 3000 },
  4: { crystal: 10, shard: 5,  coin: 8000 },
  5: { crystal: 16, shard: 10, coin: 20000 }
};
export function evolveCostTo(star) { return EVOLVE_COST[star] || null; }

/* ===================== ショップ ===================== */
export const SHOP_ITEMS = [
  { id: 'sh_c1', type: 'character', charId: 'fl_gald',   emoji: '🔥', price: 800  },
  { id: 'sh_c2', type: 'character', charId: 'aq_reina',  emoji: '💧', price: 2200 },
  { id: 'sh_c3', type: 'character', charId: 'lm_lily',   emoji: '💗', price: 2200 },
  { id: 'sh_c4', type: 'character', charId: 'wd_zeek',   emoji: '🌿', price: 2200 },
  { id: 'sh_orb',   type: 'orb',   amount: 3,    emoji: '💎', price: 5000 },
  { id: 'sh_frepo', type: 'frepo', amount: 1000, emoji: '🎗️', price: 1200 }
];

/* ===================== ガチャ ===================== */
/** ★5はガチャから出ない(進化専用) */
export const GACHA_POOL = CHARACTERS.filter(c => c.rarity <= MAX_GACHA_RARITY);
export const FREPO_POOL = GACHA_POOL.filter(c => c.rarity <= 3);

export const FREPO_WEIGHTS = { 1: 58, 2: 30, 3: 12 };
export const ORB_WEIGHTS   = { 1: 28, 2: 34, 3: 26, 4: 12 };
/** 10連の最後の1枠で使う「★3以上確定」の重み */
export const ORB_GUARANTEE_WEIGHTS   = { 3: 78, 4: 22 };
export const FREPO_GUARANTEE_WEIGHTS = { 2: 70, 3: 30 };

export const FREPO_COST = 300;
export const ORB_COST = 5;
export const MULTI_PULL = 10;
/** 10連は1回ぶんおまけ(9回ぶんの価格) */
export const FREPO_COST_MULTI = FREPO_COST * 9;
export const ORB_COST_MULTI = ORB_COST * 9;

/** ピックアップ:★4を引いたとき、この確率で看板キャラになる */
export const PICKUP_CHARACTER = FEATURED_CHARACTER;
export const PICKUP_RATE = 0.3;

/* ===================== フレンド ===================== */
export const MAX_FRIENDS = 30;
export const FRIEND_ADD_REWARD = 300;
export const FRIEND_ADD_REWARD_OTHER = 300;
export const FRIEND_GREET_REWARD = 20;
export const FRIEND_GREET_REWARD_OTHER = 10;

/* ===================== スタミナ / ランク ===================== */
export const STAMINA_REGEN_MS = 3 * 60 * 1000;  // 3分で1回復
export const STAMINA_BASE_MAX = 100;            // ランク1の上限
export const STAMINA_PER_RANK = 5;              // ランクアップごとの上限増加
export function expToNextRank(rank) { return 100 + (rank - 1) * 50; }
