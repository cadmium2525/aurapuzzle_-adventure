/* =========================================================
 * gamedata.js — 静的ゲームデータのハブ
 * オーラ/キャラクターは characters.js、スキルは skills.js に定義し、
 * ここではステージ・ショップ・ガチャ・各種定数をまとめる。
 * =======================================================*/
export * from './characters.js';
export * from './skills.js';

import { CHARACTERS } from './characters.js';

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
export const SIMUL_BONUS = 0.15;
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
      expReward: 25 * s
    });
  }
  return list;
})();

export const HARD_HP_MULT = 1.8;
export const HARD_REWARD_MULT = 1.6;
export const HARD_STAMINA_MULT = 1.5;

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
export const FREPO_WEIGHTS = { 1: 60, 2: 30, 3: 10 };
export const ORB_WEIGHTS   = { 1: 30, 2: 30, 3: 23, 4: 12, 5: 5 };
export const FREPO_COST = 300;
export const ORB_COST = 5;
export const FREPO_POOL = CHARACTERS.filter(c => c.rarity <= 3);

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
