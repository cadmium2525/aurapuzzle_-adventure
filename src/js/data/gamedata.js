/* =========================================================
 * gamedata.js — 静的なゲームデータ定義
 * 属性 / モンスター / ステージ / ショップ / 各種定数
 * =======================================================*/

/* --- オーラ(オーブ)は4色。c3=ピンクは「回復」の役割を持つ --- */
export const ELEMENTS = [
  { key: 'c0', name: '火',   emoji: '🔥', role: 'attack' },
  { key: 'c1', name: '水',   emoji: '💧', role: 'attack' },
  { key: 'c2', name: '木',   emoji: '🌿', role: 'attack' },
  { key: 'c3', name: '癒',   emoji: '💗', role: 'heal'   }
];

/** 盤面で使う色キー(ELEMENTS と同じ並び) */
export const COLORS = ELEMENTS.map(e => e.key);
/** 回復オーラの色インデックス */
export const HEAL_COLOR = ELEMENTS.findIndex(e => e.role === 'heal');

export const COLOR_HEX  = { c0: '#FF6B57', c1: '#3FC6E8', c2: '#4CD97B', c3: '#FF7EB6' };
export const COLOR_DARK = { c0: '#C94A3A', c1: '#1E8FAE', c2: '#26A75C', c3: '#C94E86' };

export const RARITY_TITLE = { 1: '見習い', 2: '戦士', 3: '精鋭', 4: '英雄', 5: '伝説' };
export const RARITY_STATS = {
  1: { atk: 5,  hp: 9  },
  2: { atk: 10, hp: 15 },
  3: { atk: 17, hp: 24 },
  4: { atk: 26, hp: 35 },
  5: { atk: 40, hp: 52 }
};

/* --- モンスター図鑑 --- */
export const MONSTER_POOL = [];
ELEMENTS.forEach((el, ei) => {
  for (let r = 1; r <= 5; r++) {
    const base = RARITY_STATS[r];
    MONSTER_POOL.push({
      id: `${el.key}_${r}`,
      name: `${RARITY_TITLE[r]}の${el.name}霊`,
      element: ei,
      rarity: r,
      atk: base.atk,
      hp: base.hp
    });
  }
});
export function monsterById(id) { return MONSTER_POOL.find(m => m.id === id); }

/* --- 編成は自分3体+フレンドレンタル1体の計4体 --- */
export const TEAM_SIZE = 3;
export const FRIEND_SLOT = 1;

/* --- ステージ --- */
const ENEMY_EMOJIS = ['👹','🐉','👻','🧟','🦂','🕷️','🐍','💀','🦑','👺','🐺','🦁','🐲','🧌','👽'];
export const FLOORS_PER_STAGE = 5;

export const STAGES = (() => {
  const list = [];
  for (let s = 1; s <= 5; s++) {
    const floors = [];
    for (let f = 1; f <= FLOORS_PER_STAGE; f++) {
      const isBoss = f === FLOORS_PER_STAGE;
      floors.push({
        name: isBoss ? 'ボス' : `フロア${f}`,
        emoji: ENEMY_EMOJIS[(s * 5 + f) % ENEMY_EMOJIS.length],
        hp: 150 + (s - 1) * 220 + (f - 1) * 70,
        atk: 8 + (s - 1) * 10 + (f - 1) * 3,
        interval: isBoss ? 1 : 2   // 何ターンごとに攻撃してくるか
      });
    }
    list.push({
      id: s,
      name: `ステージ${s}`,
      floors,
      // 初期ダンジョンの消費スタミナは5
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

/* --- ショップ --- */
export const SHOP_ITEMS = [
  { id: 'sh_m2',    type: 'monster', monsterId: 'c0_2', emoji: '🔥', price: 800  },
  { id: 'sh_m3',    type: 'monster', monsterId: 'c1_3', emoji: '💧', price: 2200 },
  { id: 'sh_m4',    type: 'monster', monsterId: 'c3_3', emoji: '💗', price: 2200 },
  { id: 'sh_orb',   type: 'orb',     amount: 3,         emoji: '💎', price: 5000 },
  { id: 'sh_frepo', type: 'frepo',   amount: 1000,      emoji: '🎗️', price: 1200 }
];

/* --- ガチャ --- */
export const FREPO_WEIGHTS = { 1: 60, 2: 30, 3: 10 };
export const ORB_WEIGHTS   = { 1: 35, 2: 30, 3: 20, 4: 10, 5: 5 };
export const FREPO_COST = 300;
export const ORB_COST = 5;

/* --- フレンド --- */
export const MAX_FRIENDS = 30;
export const FRIEND_ADD_REWARD = 300;    // フレンド登録時に自分がもらえるフレポ
export const FRIEND_ADD_REWARD_OTHER = 300; // 相手側がもらえるフレポ
export const FRIEND_GREET_REWARD = 20;      // 毎日1回のあいさつで自分がもらえるフレポ
export const FRIEND_GREET_REWARD_OTHER = 10; // あいさつで相手がもらえるフレポ

/* --- スタミナ / ランク --- */
export const STAMINA_REGEN_MS = 3 * 60 * 1000;  // 3分で1回復
export const STAMINA_BASE_MAX = 100;            // ランク1の上限
export const STAMINA_PER_RANK = 5;              // ランクアップごとの上限増加
export function expToNextRank(rank) { return 100 + (rank - 1) * 50; }
