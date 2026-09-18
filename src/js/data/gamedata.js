/* =========================================================
 * gamedata.js — 静的ゲームデータのハブ
 * オーラ/キャラクターは characters.js、スキルは skills.js に定義し、
 * ここではステージ・ショップ・ガチャ・各種定数をまとめる。
 * =======================================================*/
export * from './characters.js';
export * from './skills.js';
export * from './enemies.js';
import { ENEMIES } from './enemies.js';

import { CHARACTERS, MAX_GACHA_RARITY, FEATURED_CHARACTER } from './characters.js';
import { CUSTOM_SETTINGS } from './custom.js';

/* --- 編成は自分3人 + サポート1人(フレンド or NPC)の計4人 --- */
export const TEAM_SIZE = 3;
export const SUPPORT_SLOT = 1;

/* ===================== バトル定数 ===================== */
/** オーラ操作の基本時間(ms)。リーダースキル/スキルで延長できる */
export const BASE_DRAG_TIME = 10000;
/** 操作時間の上限(ms)。延長を盛っても青天井にはしない */
export const MAX_DRAG_TIME = 40000;
/** 攻撃力 → ダメージへの換算係数 */
export const ATTACK_SCALE = 1.0;
/** 回復力 → 回復量への換算係数 */
export const HEAL_SCALE = 2.4;
/** 最低連結数を1個超えるごとの威力上昇 */
export const ORB_BONUS = 0.35;
/** 最終チェイン数に応じて手番全体へ掛ける倍率の上昇 */
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
const STAGE_AURA      = [0, 1, 2, 3, 0];   // 1〜2章(4色)
const STAGE_AURA_DARK = [0, 1, 2, 3, 4];   // 3章以降(闇を含む5色)

/* --- 盤面に出るオーラ ---
   1〜2章は火・水・木・癒の4色。3章から闇が加わって5色になる。
   ステージが持つ auras がそのまま盤面の生成・補充に使われ(board.js の
   setPalette)、ダンジョン選択画面にも表示される。 */
export const BASE_AURAS = [0, 1, 2, 3];
export const DARK_AURA = 4;
export const DARK_FROM_CHAPTER = 3;
export const AURAS_WITH_DARK = BASE_AURAS.concat([DARK_AURA]);
/** その章で盤面に出るオーラ */
export function aurasForChapter(ch) {
  return ch >= DARK_FROM_CHAPTER ? AURAS_WITH_DARK : BASE_AURAS;
}

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
        const enemy = ENEMIES[(id * 5 + f) % ENEMIES.length];
        floors.push({
          enemyId: enemy.id,
          name: enemy.name,
          emoji: ENEMY_EMOJIS[(id * 5 + f) % ENEMY_EMOJIS.length],
          sprite: enemy.sprite,
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
        // 全50ステージを順に初回クリアすると、おおむねランク16前後になる配分
        expReward: 18 + step * 5,
        charExpReward: 80 + step * 95,
        auras: aurasForChapter(ch),
        dropAura: (ch >= DARK_FROM_CHAPTER ? STAGE_AURA_DARK : STAGE_AURA)[(i - 1) % STAGE_AURA.length],
        shardRate: Math.min(0.85, 0.18 + step * 0.045),
        crystalBase: 2 + Math.floor(step / 6),   // 奥へ進むほど結晶も増える
        dropType: 'normal'
      });
    }
  }
  return list;
})();

/* ===================== テクニカルダンジョン =====================
 * ボスはいない代わりに、**全フロア**が特殊行動を持つ。
 * オーラを消すだけでは通らず、連鎖数・形・色を組み立てて崩す場所。
 *
 * 10階層 × 5ステージ × 5フロア。難易度はノーマルとハード。
 * 初クリア(難易度ごとに1回)でダイヤが1個もらえる。
 * ==============================================================*/
export const TECH_CHAPTER_COUNT = 10;
export const TECH_STAGES_PER_CHAPTER = 5;
/** 通常(1〜50)・曜日(1000番台)・降臨(2001)と重ならない番号にする */
const TECH_ID_BASE = 3000;
/** 初クリアで配るダイヤの数(難易度ごとに1回だけ) */
export const TECH_FIRST_CLEAR_ORB = 1;

const TECH_CHAPTER_NAMES = [
  '連鎖の試練', '形の試練',   '束縛の試練', '刻限の試練', '吸収の試練',
  '鉄壁の試練', '沈黙の試練', '重圧の試練', '混沌の試練', '極まりの試練'
];
const TECH_STAGE_SUFFIX = ['初門', '二門', '三門', '四門', '極門'];
const TECH_SHAPES = ['L', 'cross', 'square', 'line'];

export function techChapterNameOf(ch) { return TECH_CHAPTER_NAMES[ch - 1] || ''; }
/** その階層の最終ステージID(クリアで次の階層が解禁される) */
export function techChapterLastStageId(ch) { return TECH_ID_BASE + ch * TECH_STAGES_PER_CHAPTER; }

/**
 * フロア1つぶんの特殊行動。10種類を順に巡らせるので、
 * 1ステージ(5フロア)で5種類、2ステージで一巡する。
 *
 * ずっと続くのは耐えきれる3種類だけ(連鎖ガード・根性・ビルドアップ)。
 * 形ガードや吸収をフロアの間ずっと続けると、手持ちのオーラ次第で
 * 手も足も出なくなるので、こちらはターン数を区切って先制で撃たせる。
 *
 * @param {number} kind 0〜9 の種類
 * @param {number} lv   階層(1〜10)。奥ほど条件が厳しくなる
 * @param {number} seed 色や形を散らすための通し番号
 */
function techSkills(kind, lv, seed) {
  const aura = seed % 5;
  const hit = effect => ({ preemptive: { effects: [effect] } });
  switch (kind) {
    case 0: return { passives: [{ type: 'comboGuard', chains: 2 + Math.ceil(lv / 3) }] };
    case 1: return hit({ type: 'shapeGuard', aura, shape: TECH_SHAPES[seed % TECH_SHAPES.length],
      turns: 2 + Math.floor(lv / 4) });
    case 2: return hit({ type: 'auraAbsorb', aura, turns: 2 + Math.floor(lv / 4) });
    case 3: return hit({ type: 'bind', count: 1 + Math.floor(lv / 6), turns: 1 + Math.floor(lv / 4) });
    case 4: return hit({ type: 'skillDelay', count: 2 + Math.floor(lv / 5), turns: 1 + Math.floor(lv / 6) });
    case 5: return hit({ type: 'timeReduce', seconds: 1 + Math.floor(lv / 5), turns: 2 + Math.floor(lv / 3) });
    case 6: return hit({ type: 'timeFixed', seconds: Math.max(3, 6 - Math.floor(lv / 3)),
      turns: 1 + Math.floor(lv / 4) });
    case 7: return { passives: [{ type: 'resolve', threshold: 25 + lv * 2 }] };
    case 8: return { passives: [{ type: 'buildUp' }] };
    default: return hit({ type: 'auraBind', aura, turns: 1 + Math.floor(lv / 4) });
  }
}

export const TECHNICAL_STAGES = (() => {
  const list = [];
  for (let ch = 1; ch <= TECH_CHAPTER_COUNT; ch++) {
    for (let i = 1; i <= TECH_STAGES_PER_CHAPTER; i++) {
      const order = (ch - 1) * TECH_STAGES_PER_CHAPTER + i;   // 1〜50
      const step = order - 1;                                  // 0始まりの通し難易度
      const floors = [];
      for (let f = 1; f <= FLOORS_PER_STAGE; f++) {
        const seed = step * FLOORS_PER_STAGE + (f - 1);
        const enemy = ENEMIES[(seed * 3 + 1) % ENEMIES.length];
        floors.push({
          enemyId: enemy.id,
          name: enemy.name,
          emoji: ENEMY_EMOJIS[(seed * 3 + 1) % ENEMY_EMOJIS.length],
          sprite: enemy.sprite,
          // ボスがいないので、フロアごとの山谷は付けず素直に上げていく
          hp: Math.round(200 + step * 250 + (f - 1) * (90 + step * 22)),
          atk: Math.round(10 + step * 8 + (f - 1) * (3.5 + step * 0.7)),
          interval: 2,
          enemySkills: techSkills(seed % 10, ch, seed)
        });
      }
      list.push({
        id: TECH_ID_BASE + order,
        technical: true,
        chapter: ch,
        name: `${ch}-${i} ${TECH_CHAPTER_NAMES[ch - 1]}・${TECH_STAGE_SUFFIX[i - 1]}`,
        floors,
        stamina: 8 + Math.floor(step * 1.1),
        coinReward: 200 + step * 130,
        orbReward: 0,                       // 周回では配らない
        firstClearOrb: TECH_FIRST_CLEAR_ORB, // 初クリアのときだけ
        expReward: 22 + step * 6,
        charExpReward: 110 + step * 110,
        auras: aurasForChapter(ch),
        dropAura: (ch >= DARK_FROM_CHAPTER ? STAGE_AURA_DARK : STAGE_AURA)[(i - 1) % STAGE_AURA.length],
        shardRate: Math.min(0.9, 0.25 + step * 0.05),
        crystalBase: 3 + Math.floor(step / 5),
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
 *  土      常闇の進化素材
 *  日      キャラクターの経験値アイテム
 *
 * 常闇(オーラ4)だけ長らく曜日が無く、通常ダンジョンでも50ステージ中8つ
 * (3章以降の各章5ステージ目)しか落とさない詰まりどころだった。
 * 土日が両方とも経験値で重複していたので、土曜を常闇に充てて埋めている。
 */
export const DAILY_THEMES = [
  { day: 0, label: '日', title: '賢者の書庫', emoji: '📗', dropType: 'exp',     dropAura: null, note: 'キャラ経験値アイテム' },
  { day: 1, label: '月', title: '聖光の祭壇', emoji: '🩷', dropType: 'crystal', dropAura: 3,    note: '回復キャラの進化素材' },
  { day: 2, label: '火', title: '紅蓮の炉',   emoji: '🔴', dropType: 'crystal', dropAura: 0,    note: '火の進化素材' },
  { day: 3, label: '水', title: '蒼海の泉',   emoji: '🔵', dropType: 'crystal', dropAura: 1,    note: '水の進化素材' },
  { day: 4, label: '木', title: '翠緑の苗床', emoji: '🟢', dropType: 'crystal', dropAura: 2,    note: '木の進化素材' },
  { day: 5, label: '金', title: '黄金の坑道', emoji: '💰', dropType: 'gold',    dropAura: null, note: 'ゴールド特化' },
  { day: 6, label: '土', title: '常闇の深淵', emoji: '🟣', dropType: 'crystal', dropAura: 4,    note: '闇キャラの進化素材' }
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
      const enemy = ENEMIES[(day * 3 + d.tier + f) % ENEMIES.length];
      floors.push({
        enemyId: enemy.id,
        name: enemy.name,
        emoji: ENEMY_EMOJIS[(day * 3 + d.tier + f) % ENEMY_EMOJIS.length],
        sprite: enemy.sprite,
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
      name: `${t.title} ${d.name}`,
      floors,
      stamina: d.stamina,
      coinReward: Math.round((t.dropType === 'gold' ? 3000 : 400) * d.mult),
      orbReward: 0,
      expReward: Math.round(25 * d.mult),
      charExpReward: Math.round(200 * d.mult),
      dropAura: t.dropAura,
      // 初級は4色のまま。中級(ランク8)以上は通常ダンジョンの3章以降に合わせて闇も出る
      auras: d.tier >= 2 ? AURAS_WITH_DARK : BASE_AURAS,
      shardRate: t.dropType === 'crystal' ? Math.min(0.9, 0.35 * d.mult) : 0,
      dropType: t.dropType,
      dropMult: d.mult
    };
  });
}

/** 今日の曜日テーマ */
export function todayTheme() { return DAILY_THEMES[new Date().getDay()]; }

/**
 * 今日の曜日ダンジョンが落とす結晶のID。
 * ゴールド(金)と経験値(日)の日は結晶が無いので null を返す。
 */
export function shopCrystalToday() {
  const t = todayTheme();
  return t.dropType === 'crystal' ? `mt_c${t.dropAura}` : null;
}

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
  { id: 'mt_c4',   name: '常闇の結晶', emoji: '🟣', aura: 4,    color: '#A76BFF' },
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
/**
 * スタミナドリンク。
 *
 * 値段を決めるにあたって測った数字:
 *   スタミナは3分で1回復 = 1日480。
 *   金曜「黄金の坑道 上級」は 15000コイン / スタミナ25 = 600コイン/スタミナ。
 *     (曜日ダンジョンにハードはないので、これがコイン効率の上限)
 *   ショップのオーブ小袋は 5000コイン = 3ダイヤ → 1ダイヤ = 1667コイン。
 *   この2つを繋ぐと スタミナ1 = 0.36ダイヤ。
 *
 * コイン建てにすると即壊れる。0.36ダイヤ = 600コインより安くコインで
 * スタミナを買えたら、そのまま無限に回せてしまうため。
 *
 * ダイヤ建てにしても輪が閉じるわけではない。オーブ小袋がある限り
 * 「ダイヤ→スタミナ→コイン→ダイヤ」は繋がっていて、💎2で買った50スタミナは
 * 金曜上級なら 30000コイン = 18ダイヤぶんになる。ただしこれは
 * オーブ小袋と曜日ダンジョンのレートの問題で、ドリンク側で塞ぐものではない
 * (塞げる値段は💎18以上で、ガチャ1回5ダイヤに対して誰も買わない死に商品になる)。
 * ドリンクにできるのは増える量を頭打ちにすることなので、1日の本数を絞る。
 */
export const STAMINA_DRINK = {
  amount: 50,      // 3分で1回復なので、2時間半ぶん
  price: 2,        // ガチャ1回が5ダイヤ。1回ぶんで125スタミナ買える計算
  dailyLimit: 3    // 1日 +150 まで。自然回復(1日480)の3割程度に収まる
};

/**
 * オーブ小袋。コインをダイヤに替える唯一の道なので、**1日1個まで**。
 *
 * 上限を置く理由は、レートを合わせるだけでは足りないから。
 * 上限が無いと、ダイヤの供給がコイン収入にそのまま比例してしまう:
 *   金曜「黄金の坑道 上級」は 600コイン/スタミナ、
 *   平日の最良(9-2 ハード)でも 121コイン/スタミナ。
 *   1日480スタミナぶん回すと、週728,124コイン = 旧レートで437ダイヤ。
 *   意図した供給(初クリア約120 + ログボ月12前後)と桁が違う。
 * 金曜は週1日しか開かないので全体の55%でしかなく、金曜を消しても
 * 週244ダイヤ残る。つまり原因は金曜ではなく小袋のレートそのもの。
 *
 * 値上げだけで抑えるとダンジョンを足すたびにレートを取り合うことになる。
 * 上限なら、コイン収入がいくつでもダイヤの蛇口が 3個/日 で止まる。
 *
 * 値段の 20000 は ★4→★5 の進化1回ぶんと同額。
 * 「進化を1段進めるか、ダイヤ3個を取るか」という選択にしたい。
 * これでスタミナドリンク(💎2×3本=6ダイヤ)で稼いでも1日3ダイヤしか
 * 戻らないので、ダイヤ→スタミナ→コイン→ダイヤの輪も赤字で閉じる。
 */
export const ORB_POUCH = { amount: 3, price: 20000, dailyLimit: 1 };

export const SHOP_ITEMS = [
  // 買い切り。初心者向けの拾い物枠であって、素材の自動販売機ではない。
  // 何度も買えると「買って送還」で素材とコインが増え続けてしまう:
  //   ゴラン 800コイン → 送還で 500コイン + 結晶2 + 開眼の証1
  //   = 実質300コインで結晶2個。結晶1個あたり150コインで無制限に買えた。
  // 送還すると所持数は0に戻るので、所持の有無ではなく通算購入数で止める。
  { id: 'sh_c1', type: 'character', charId: 'fl_gald',   emoji: '🔥', price: 800,  totalLimit: 1 },
  { id: 'sh_c2', type: 'character', charId: 'aq_reina',  emoji: '💧', price: 2200, totalLimit: 1 },
  { id: 'sh_c3', type: 'character', charId: 'lm_lily',   emoji: '💗', price: 2200, totalLimit: 1 },
  { id: 'sh_c4', type: 'character', charId: 'wd_zeek',   emoji: '🌿', price: 2200, totalLimit: 1 },
  /* --- 素材枠。どれも1日1回で、コインの行き先を毎日作るためのもの ---
   * 値段はショップのキャラを買い切りにして底値が消えたぶん、素直に決められる。
   * 全部買うと1日21,500コイン。小袋と合わせて41,500コインなので、
   * 回し込む人の1日の収入(平日の最良で約58,000コイン)でも選ぶことになる。 */
  { id: 'sh_shard', type: 'material', matId: 'mt_star', amount: 2, price: 4000, dailyLimit: 1,
    note: '進化に共通で要る' },
  // 今日の曜日ダンジョンと同じ結晶。スタミナを使わずに買い足せる枠。
  // ゴールドの金曜と経験値の日曜は落ちる結晶が無いので、その日は並べない。
  { id: 'sh_crystal', type: 'crystalToday', amount: 5, price: 2500, dailyLimit: 1,
    note: '今日の曜日と同じ' },
  { id: 'sh_exp', type: 'material', matId: 'mt_exp2', amount: 3, price: 3000, dailyLimit: 1,
    note: '編成外も育てる' },
  { id: 'sh_awaken', type: 'material', matId: 'mt_awaken', amount: 1, price: 12000, dailyLimit: 1,
    note: '被り以外の開眼' },
  { id: 'sh_orb', type: 'orb', amount: ORB_POUCH.amount, emoji: '💎',
    price: ORB_POUCH.price, dailyLimit: ORB_POUCH.dailyLimit, unit: '個' },
  { id: 'sh_stamina', type: 'stamina', amount: STAMINA_DRINK.amount, emoji: '⚡',
    currency: 'orb', price: STAMINA_DRINK.price, dailyLimit: STAMINA_DRINK.dailyLimit, unit: '本' }
];

/* ===================== ガチャ ===================== */
/** ★5はガチャから出ない(進化専用)。giftOnly の配布キャラも対象外 */
export const GACHA_POOL = CHARACTERS.filter(c => c.rarity <= MAX_GACHA_RARITY && !c.giftOnly);
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
/** ★4帯のうちピックアップが占める割合。管理者ツールで変えられる */
export const PICKUP_RATE =
  typeof CUSTOM_SETTINGS.pickupRate === 'number' ? CUSTOM_SETTINGS.pickupRate : 0.3;

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

/* ===================== 配布プレゼント ===================== */
/**
 * コードに埋め込む配布。key ごとに一度だけプレゼントボックスへ入る
 * (Firestore を使わないので、オフラインでも全員に届く)。
 * 追加で配りたくなったら新しい key の行を足す。既存の key を書き換えても
 * 受け取り済みの人には届かないので、配り直しは新しい key で行うこと。
 */
export const BUILTIN_GIFTS = [
  {
    key: 'gift_dark_debut',
    title: '闇のオーラ解禁記念',
    note: '3章から盤面に闇のオーラが加わります。闇のキャラクターをお受け取りください。',
    char: 'dk_shion'
  },
  {
    key: 'gift_x_launch',
    title: 'X公開記念',
    note: '応援ありがとうございます!',
    orb: 45
  },
  {
    key: 'gift_raid_kyuko',
    title: '九狐降臨 実装記念',
    note: '降臨ダンジョン「九狐降臨」が登場しました。挑戦の準備にお役立てください。',
    orb: 45
  }
];

/* ===================== ログインボーナス ===================== */
/**
 * 1日1回、その日はじめての起動でプレゼントボックスに入る。
 * 連続でログインするほど増えるが、LOGIN_STREAK_MAX 日ぶんで頭打ちになる
 * (それ以上続けても上限額のまま。途切れると1日目へ戻る)。
 * オーブは LOGIN_ORB_EVERY 日ごとの区切りでだけ入る。
 */
export const LOGIN_STREAK_MAX = 10;
export const LOGIN_COIN_BASE = 300;
export const LOGIN_COIN_STEP = 100;
export const LOGIN_ORB_EVERY = 5;
export const LOGIN_ORB = 2;

/** 連続n日目の受け取り内容 */
export function loginBonusFor(streak) {
  const day = Math.max(1, Math.min(streak, LOGIN_STREAK_MAX));
  const reward = { coin: LOGIN_COIN_BASE + LOGIN_COIN_STEP * (day - 1) };
  // 5日ごとの節目。上限に達したあとも節目は巡ってくるので streak 側で判定する
  if (streak % LOGIN_ORB_EVERY === 0) reward.orb = LOGIN_ORB;
  return reward;
}

/* ===================== スタミナ / ランク ===================== */
export const STAMINA_REGEN_MS = 3 * 60 * 1000;  // 3分で1回復
export const STAMINA_BASE_MAX = 100;            // ランク1の上限
export const STAMINA_PER_RANK = 5;              // ランクアップごとの上限増加
export function expToNextRank(rank) { return 100 + (rank - 1) * 50; }
