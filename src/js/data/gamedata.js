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
/** 敵のイラスト。読み込めないときは上の絵文字に落ちる */
const ENEMY_SPRITES = ['gia','gorem','gost','kongou','monolith','raiga','worm']
  .map(n => `assets/enemy/${n}.webp`);
export const FLOORS_PER_STAGE = 5;

/** 章ごとのステージ名(1章5ステージ × 10章) */
const CHAPTER_NAMES = [
  '旅立ちの野', '水鏡の湖', '灼熱の谷', '常闇の森', '天空の回廊',
  '朽ちた王都', '氷結の海', '竜骨の荒野', '虚無の狭間', '世界樹の頂'
];
const STAGE_NAMES = [
  ['始まりの街道', 'せせらぎの丘', '風鳴りの草原', '古い石橋', '街道の関所'],
  ['霧ふる湖畔',   '沈んだ桟橋',   '水鏡の浅瀬',   '雨音の洞',   '湖底の神殿'],
  ['灼熱の峡谷',   '燻る火口',     '灰かぶりの道', '溶岩の回廊', '炎帝の玉座'],
  ['常闇の樹海',   '苔むす遺構',   '毒沼の径',     '巨木の根元', '樹海の心臓'],
  ['天空回廊',     '浮遊する石段', '雷雲の足場',   '風神の露台', '天空の門'],
  ['朽ちた城下',   '崩れた城壁',   '王都の墓所',   '玉座の間',   '亡王の広間'],
  ['氷結の入江',   '流氷の道',     '凍てつく灯台', '氷檻の洞窟', '氷海の主'],
  ['竜骨の荒野',   '風食の岩塔',   '砂に眠る翼',   '竜の墓場',   '古竜の祭壇'],
  ['虚無の狭間',   '歪んだ回廊',   '無音の広間',   '影の三叉路', '狭間の番人'],
  ['大樹の根',     '螺旋の枝道',   '天枝の宿り木', '星の見える葉', '世界樹の頂']
];
/** ステージごとに主に落ちる結晶のオーラ(章のなかで一巡させる) */
const STAGE_AURA = [0, 1, 2, 3, 0];

export const CHAPTER_COUNT = CHAPTER_NAMES.length;
export const STAGES_PER_CHAPTER = 5;
export function chapterNameOf(ch) { return CHAPTER_NAMES[ch - 1] || ''; }
/** その章の最終ステージID(クリアで次の章が解禁される) */
export function chapterLastStageId(ch) { return ch * STAGES_PER_CHAPTER; }

export const STAGES = (() => {
  const list = [];
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) {
    for (let i = 1; i <= STAGES_PER_CHAPTER; i++) {
      const id = (ch - 1) * STAGES_PER_CHAPTER + i;   // 通し番号。旧セーブの1〜5はそのまま使える
      const step = id - 1;                            // 0始まりの通し難易度
      const floors = [];
      for (let f = 1; f <= FLOORS_PER_STAGE; f++) {
        const isBoss = f === FLOORS_PER_STAGE;
        floors.push({
          name: isBoss ? `${STAGE_NAMES[ch - 1][i - 1]}の主` : `フロア${f}`,
          emoji: ENEMY_EMOJIS[(id * 5 + f) % ENEMY_EMOJIS.length],
          sprite: ENEMY_SPRITES[(id * 5 + f) % ENEMY_SPRITES.length],
          hp: Math.round((120 + step * 210 + (f - 1) * (60 + step * 16)) * (isBoss ? 1.6 : 1)),
          atk: Math.round(8 + step * 7.5 + (f - 1) * (3 + step * 0.6)),
          interval: isBoss ? 1 : 2   // 何ターンごとに攻撃してくるか
        });
      }
      list.push({
        id,
        chapter: ch,
        name: `${ch}-${i} ${STAGE_NAMES[ch - 1][i - 1]}`,
        floors,
        stamina: 5 + Math.floor(step * 0.9),
        coinReward: 150 + step * 110,
        orbReward: i === STAGES_PER_CHAPTER ? 2 : 0,   // 各章の最終ステージだけオーブ
        expReward: 25 + step * 14,
        charExpReward: 80 + step * 95,
        dropAura: STAGE_AURA[(i - 1) % STAGE_AURA.length],
        shardRate: Math.min(0.85, 0.18 + step * 0.045),
        crystalBase: 2 + Math.floor(step / 6),   // 奥へ進むほど結晶も増える
        dropType: 'normal'
      });
    }
  }
  return list;
})();

/* ===================== 曜日ダンジョン ===================== */
/**
 * 曜日ごとに手に入るものが変わる。0=日 〜 6=土。
 *  月      癒(回復キャラ)の進化素材
 *  火水木  それぞれ火・水・木の進化素材
 *  金      ゴールド特化
 *  土日    キャラクターの経験値アイテム
 */
export const DAILY_THEMES = [
  { day: 0, label: '日', title: '賢者の書庫', emoji: '📗', dropType: 'exp',     dropAura: null, note: 'キャラ経験値アイテム' },
  { day: 1, label: '月', title: '聖光の祭壇', emoji: '🩷', dropType: 'crystal', dropAura: 3,    note: '回復キャラの進化素材' },
  { day: 2, label: '火', title: '紅蓮の炉',   emoji: '🔴', dropType: 'crystal', dropAura: 0,    note: '火の進化素材' },
  { day: 3, label: '水', title: '蒼海の泉',   emoji: '🔵', dropType: 'crystal', dropAura: 1,    note: '水の進化素材' },
  { day: 4, label: '木', title: '翠緑の苗床', emoji: '🟢', dropType: 'crystal', dropAura: 2,    note: '木の進化素材' },
  { day: 5, label: '金', title: '黄金の坑道', emoji: '💰', dropType: 'gold',    dropAura: null, note: 'ゴールド特化' },
  { day: 6, label: '土', title: '賢者の書庫', emoji: '📗', dropType: 'exp',     dropAura: null, note: 'キャラ経験値アイテム' }
];

/** 曜日ダンジョンの難易度(プレイヤーランクで解放) */
const DAILY_TIERS = [
  { tier: 1, name: '初級', rank: 1,  stamina: 8,  mult: 1,   hp: 900,   atk: 40 },
  { tier: 2, name: '中級', rank: 8,  stamina: 15, mult: 2.4, hp: 3200,  atk: 95 },
  { tier: 3, name: '上級', rank: 18, stamina: 25, mult: 5,   hp: 9000,  atk: 190 }
];

/** その曜日に挑めるステージ一覧を返す(idは 1000番台で通常ステージと分ける) */
export function dailyStagesFor(day) {
  const t = DAILY_THEMES[day];
  if (!t) return [];
  return DAILY_TIERS.map(d => {
    const floors = [];
    for (let f = 1; f <= FLOORS_PER_STAGE; f++) {
      const isBoss = f === FLOORS_PER_STAGE;
      floors.push({
        name: isBoss ? `${t.title}の主` : `フロア${f}`,
        emoji: ENEMY_EMOJIS[(day * 3 + d.tier + f) % ENEMY_EMOJIS.length],
        sprite: ENEMY_SPRITES[(day * 3 + d.tier + f) % ENEMY_SPRITES.length],
        hp: Math.round((d.hp + (f - 1) * d.hp * 0.25) * (isBoss ? 1.6 : 1)),
        atk: Math.round(d.atk + (f - 1) * d.atk * 0.15),
        interval: isBoss ? 1 : 2
      });
    }
    return {
      id: 1000 + day * 10 + d.tier,
      daily: true,
      day,
      tier: d.tier,
      requireRank: d.rank,
      name: `${t.emoji} ${t.title} ${d.name}`,
      floors,
      stamina: d.stamina,
      coinReward: Math.round((t.dropType === 'gold' ? 3000 : 400) * d.mult),
      orbReward: 0,
      expReward: Math.round(40 * d.mult),
      charExpReward: Math.round(200 * d.mult),
      dropAura: t.dropAura,
      shardRate: t.dropType === 'crystal' ? Math.min(0.9, 0.35 * d.mult) : 0,
      dropType: t.dropType,
      dropMult: d.mult
    };
  });
}

/** 今日の曜日テーマ */
export function todayTheme() { return DAILY_THEMES[new Date().getDay()]; }

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
  { id: 'mt_star',   name: '進化の輝石', emoji: '💠', aura: null, color: '#FFC65C' },
  { id: 'mt_awaken', name: '開眼の証',   emoji: '👁️', aura: null, color: '#B6EEFF' },
  { id: 'mt_exp1',   name: '経験の雫',   emoji: '🔹', aura: null, color: '#8FD8FF' },
  { id: 'mt_exp2',   name: '経験の書',   emoji: '📗', aura: null, color: '#5BE08C' }
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

/* ===================== 送還(被りの分解) ===================== */
/**
 * 被ったキャラを素材に変える。進化段階が高いほど見返りが大きい。
 * 低レアの余りを進化素材に、高レアの余りを開眼の証に流すのが狙い。
 */
export const DISMISS_REWARD = {
  1: { crystal: 1,  shard: 0, coin: 200,   awaken: 0 },
  2: { crystal: 2,  shard: 0, coin: 500,   awaken: 1 },
  3: { crystal: 5,  shard: 1, coin: 1500,  awaken: 1 },
  4: { crystal: 12, shard: 3, coin: 5000,  awaken: 3 },
  5: { crystal: 20, shard: 6, coin: 12000, awaken: 5 }
};
export function dismissRewardFor(star) { return DISMISS_REWARD[star] || DISMISS_REWARD[1]; }

/**
 * 同キャラの代わりに開眼へ使える「開眼の証」の必要数。
 * ★4を同キャラ5体そろえるのは現実的でないため、この経路を用意している。
 * 基準は素体のレアリティ(進化段階ではない)。
 */
export const AWAKEN_TOKEN_COST = { 1: 1, 2: 1, 3: 3, 4: 5, 5: 5 };
export function awakenTokenCost(baseRarity) { return AWAKEN_TOKEN_COST[baseRarity] || 1; }

/* ===================== 経験値アイテム ===================== */
/** 使うと編成外のキャラにも経験値を与えられる。曜日ダンジョンで手に入る */
export const EXP_ITEMS = {
  mt_exp1: 150,
  mt_exp2: 800
};

/* ===================== ショップ ===================== */
export const SHOP_ITEMS = [
  { id: 'sh_c1', type: 'character', charId: 'fl_gald',   emoji: '🔥', price: 800  },
  { id: 'sh_c2', type: 'character', charId: 'aq_reina',  emoji: '💧', price: 2200 },
  { id: 'sh_c3', type: 'character', charId: 'lm_lily',   emoji: '💗', price: 2200 },
  { id: 'sh_c4', type: 'character', charId: 'wd_zeek',   emoji: '🌿', price: 2200 },
  { id: 'sh_orb',   type: 'orb',   amount: 3,    emoji: '💎', price: 5000 }
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
/**
 * フレンドポイントの入手経路は2つだけ。
 *   1. 自分の貸し出しキャラが使われた回数に応じて翌日まとめて受け取る
 *   2. フレンドへのあいさつ(1日1回)
 * ダンジョン報酬・ショップ・フレンド登録ボーナスからは出さない。
 */
export const FRIEND_GREET_REWARD = 20;        // あいさつした側
export const FRIEND_GREET_REWARD_OTHER = 10;  // あいさつされた側
export const FRIEND_RENTAL_REWARD = 50;       // 貸し出しキャラが1回使われるごと

/* ===================== スタミナ / ランク ===================== */
export const STAMINA_REGEN_MS = 3 * 60 * 1000;  // 3分で1回復
export const STAMINA_BASE_MAX = 100;            // ランク1の上限
export const STAMINA_PER_RANK = 5;              // ランクアップごとの上限増加
export function expToNextRank(rank) { return 100 + (rank - 1) * 50; }
