/* =========================================================
 * characters.js — オーラ(属性)と、自陣に編成する「人物」キャラクター
 *
 * 自陣はモンスターではなく人物。各キャラクターは固有のオーラを持ち、
 * バトルでは「自分のオーラを消したときだけ」攻撃する。
 *
 * レアリティはガチャ排出が★1〜★4。★5は「進化」でのみ到達でき、
 * ステータスに加えてリーダースキルとスキルも強化される。
 * =======================================================*/
import {
  LEADER_SKILLS, ACTIVE_SKILLS, evolvedLeaderSkill, evolvedActiveSkill
} from './skills.js';

/* --- オーラは4色。c3(癒)は攻撃ではなく回復を担当する --- */
export const AURAS = [
  { key: 'c0', name: '火', emoji: '🔥', role: 'attack', label: 'FLAME' },
  { key: 'c1', name: '水', emoji: '💧', role: 'attack', label: 'AQUA'  },
  { key: 'c2', name: '木', emoji: '🌿', role: 'attack', label: 'WOOD'  },
  { key: 'c3', name: '癒', emoji: '💗', role: 'heal',   label: 'LUMEN' }
];

/** 盤面で使うオーラキー(AURAS と同じ並び) */
export const COLORS = AURAS.map(a => a.key);
export const HEAL_COLOR = AURAS.findIndex(a => a.role === 'heal');
export const auraIndexOf = key => COLORS.indexOf(key);

export const COLOR_HEX  = { c0: '#FF7A59', c1: '#45C8F1', c2: '#5BE08C', c3: '#FF86C8' };
export const COLOR_DARK = { c0: '#B8341F', c1: '#125E86', c2: '#1E8C4F', c3: '#A62E71' };
export const COLOR_GLOW = { c0: '#FFC48A', c1: '#B6EEFF', c2: '#C2FFD6', c3: '#FFD0EA' };

/** ガチャで出る最高レアリティ。★5は進化専用。 */
export const MAX_GACHA_RARITY = 4;
export const MAX_RARITY = 5;

export const RARITY_TITLE = { 1: 'N', 2: 'R', 3: 'SR', 4: 'SSR', 5: 'UR' };
export const RARITY_HEX   = { 1: '#9AA7C7', 2: '#69C6F0', 3: '#B189FF', 4: '#FFC44D', 5: '#FF7BD5' };

/** レアリティごとの基準ステータス(Lv1時点) */
const RARITY_BASE = {
  1: { atk: 8,  hp: 14, rcv: 6  },
  2: { atk: 14, hp: 24, rcv: 9  },
  3: { atk: 22, hp: 38, rcv: 13 },
  4: { atk: 34, hp: 56, rcv: 18 },
  5: { atk: 52, hp: 84, rcv: 27 }
};
/** 役割ごとのステータス補正 */
const ROLE_WEIGHT = {
  attacker: { atk: 1.25, hp: 0.85, rcv: 0.7 },
  balance:  { atk: 1.00, hp: 1.00, rcv: 1.0 },
  tank:     { atk: 0.80, hp: 1.35, rcv: 0.9 },
  healer:   { atk: 0.70, hp: 0.95, rcv: 1.7 }
};
export const ROLE_LABEL = { attacker: 'アタッカー', balance: 'バランス', tank: 'タンク', healer: 'ヒーラー' };

/** レアリティごとのレベル上限 */
export const MAX_LEVEL = { 1: 15, 2: 20, 3: 30, 4: 40, 5: 60 };
/** 1レベルごとの基準ステータス上昇率 */
export const LEVEL_GROWTH = 0.045;
/** 次のレベルに必要な経験値 */
export function expToNextCharLevel(level) { return 30 + (level - 1) * 14; }

/**
 * キャラクター1体の素体を組み立てる。
 * @param {object} extra 追加設定(artStages / evoLeaderSkillId / evoSkillId / evoName など)
 */
function mk(id, name, job, portrait, aura, rarity, role, ls, sk, extra) {
  const base = RARITY_BASE[rarity];
  const w = ROLE_WEIGHT[role];
  return Object.assign({
    id, name, job, portrait,
    aura,                      // AURAS のインデックス
    rarity, role,
    atk: Math.round(base.atk * w.atk),
    hp:  Math.round(base.hp  * w.hp),
    rcv: Math.round(base.rcv * w.rcv),
    leaderSkillId: ls,
    skillId: sk,
    artStages: null            // イラスト差し替え(未設定なら portrait の絵文字)
  }, extra || {});
}

/**
 * 「不器用なカイ」のイラスト。
 * 画像ファイルを assets/chars/ に置くと自動的に使われ、
 * 無い場合は絵文字にフォールバックする(src/js/screens/parts.js)。
 */
const KAI_ART = [
  { star: 4, minLevel: 1,  icon: 'assets/chars/kai_1_icon.png', full: 'assets/chars/kai_1.png', label: '初期' },
  { star: 4, minLevel: 20, icon: 'assets/chars/kai_2_icon.png', full: 'assets/chars/kai_1.png', label: '覚醒' },
  { star: 5, minLevel: 1,  icon: 'assets/chars/kai_2_icon.png', full: 'assets/chars/kai_2.png', label: '進化' }
];

/* --- キャラクター図鑑 --- */
export const CHARACTERS = [
  /* ===== 火 ===== */
  mk('fl_rito',   'リト',       '見習い剣士',   '🧑‍🎤', 0, 1, 'balance',  'ls_novice',  'sk_novice_time'),
  mk('fl_gald',   'ガルド',     '傭兵',         '🧔',   0, 2, 'attacker', 'ls_ember',   'sk_strike'),
  mk('fl_aina',   'アイナ',     '紅蓮の剣士',   '👩‍🦰', 0, 3, 'attacker', 'ls_blaze',   'sk_flamewave'),
  mk('fl_belg',   'ベルグ',     '砲術士',       '🧑‍🚒', 0, 3, 'balance',  'ls_burst',   'sk_warcry'),
  mk('fl_rune',   'ルネ',       '焔姫',         '👸',   0, 4, 'attacker', 'ls_inferno', 'sk_ember_time'),
  mk('fl_ignis',  'イグナス',   '業火の英雄',   '🦸',   0, 4, 'attacker', 'ls_ignis',   'sk_ignition'),

  /* ===== 水 ===== */
  mk('aq_mio',    'ミオ',       '水練生',       '🧒',   1, 1, 'balance',  'ls_ripple',  'sk_calm'),
  mk('aq_kai',    'ナギ',       '潮風の斥候',   '🧑‍✈️', 1, 2, 'balance',  'ls_scout',   'sk_delay'),
  mk('aq_shirka', 'シルカ',     '氷結術士',     '🧙‍♀️', 1, 3, 'balance',  'ls_frost',   'sk_freeze'),
  mk('aq_reina',  'レイナ',     '波乗り',       '🏄‍♀️', 1, 3, 'attacker', 'ls_tide',    'sk_aqua_conv'),
  mk('aq_nereid', 'ネレイド',   '深海の守護者', '🧜‍♀️', 1, 4, 'tank',     'ls_abyss',   'sk_barrier'),
  mk('aq_aqualis','アクアリス', '蒼海の賢者',   '🧙',   1, 4, 'balance',  'ls_aquaris', 'sk_maelstrom'),
  /* 看板キャラ。進化で専用のリーダースキル/スキルに変化する */
  mk('aq_kai_x',  '不器用なカイ', '虚空の剣士', '⚔️',  1, 4, 'attacker', 'ls_kai4',    'sk_kai4', {
    artStages: KAI_ART,
    evoLeaderSkillId: 'ls_kai5',
    evoSkillId: 'sk_kai5',
    evoName: '虚空剣のカイ',
    evoJob: '虚空を断つ者',
    featured: true,
    flavor: '剣の腕は確かなのに、言葉だけはいつまでも不器用な青年。'
  }),

  /* ===== 木 ===== */
  mk('wd_noa',    'ノア',       '森の狩人',     '🧑‍🌾', 2, 1, 'balance',  'ls_sprout',  'sk_hunt'),
  mk('wd_hami',   'ハーミ',     '薬草師',       '👩‍⚕️', 2, 2, 'healer',   'ls_herb',    'sk_heal_s'),
  mk('wd_zeek',   'ジーク',     '樹護士',       '🧑‍🔧', 2, 3, 'tank',     'ls_guard',   'sk_wood_conv'),
  mk('wd_el',     'エル',       '風読みの射手', '🏹',   2, 3, 'attacker', 'ls_wind',    'sk_wind_time'),
  mk('wd_leafia', 'リーフィア', '大樹の巫女',   '🧝‍♀️', 2, 4, 'healer',   'ls_herb',    'sk_heal_l'),
  mk('wd_yggd',   'ユグド',     '世界樹の守人', '🧝',   2, 4, 'balance',  'ls_yggd',    'sk_forest'),

  /* ===== 癒 ===== */
  mk('lm_mina',   'ミナ',       '見習い聖女',   '👧',   3, 1, 'healer',   'ls_pray',    'sk_heal_m'),
  mk('lm_sera',   'セラ',       '祈祷師',       '🧕',   3, 2, 'tank',     'ls_vow',     'sk_heal_m'),
  mk('lm_lily',   'リリィ',     '白の癒し手',   '👩‍🦳', 3, 3, 'healer',   'ls_bless',   'sk_light'),
  mk('lm_gawain', 'ガウェイン', '聖騎士',       '🤴',   3, 3, 'tank',     'ls_paladin', 'sk_holy_guard'),
  mk('lm_elmina', 'エルミナ',   '光明の司祭',   '👰',   3, 4, 'healer',   'ls_bless',   'sk_grace'),
  mk('lm_aurora', 'アウロラ',   '大聖女',       '👼',   3, 4, 'healer',   'ls_aurora',  'sk_miracle')
];

const BY_ID = new Map(CHARACTERS.map(c => [c.id, c]));
export function characterById(id) { return BY_ID.get(id) || null; }
/** ガチャの目玉(ピックアップ)キャラ */
export const FEATURED_CHARACTER = CHARACTERS.find(c => c.featured) || null;

/* =========================================================
 * レベル / 進化を反映した「実際に使うキャラクター」を組み立てる
 * =======================================================*/

/** そのレアリティのレベル上限 */
export function maxLevelFor(star) { return MAX_LEVEL[star] || MAX_LEVEL[1]; }

/** レベル・進化段階からステータス倍率を出す */
function statAt(baseStat, baseStar, star, level) {
  // 進化するとレアリティの基準値ぶん底上げされる
  const starMult = RARITY_BASE[star].atk / RARITY_BASE[baseStar].atk;
  return Math.round(baseStat * starMult * (1 + (level - 1) * LEVEL_GROWTH));
}

/** 現在のレベル/進化段階で使うイラストを選ぶ(無ければ null) */
export function artStageFor(base, star, level) {
  if (!base.artStages) return null;
  let picked = null;
  base.artStages.forEach(a => {
    if (star >= a.star && (star > a.star || level >= a.minLevel)) picked = a;
  });
  return picked;
}

/**
 * 保存データ(進化段階・レベル)を反映したキャラクターを返す。
 * 画面・バトルはすべてこの形を使う。
 * @param {string|object} idOrBase キャラID または素体
 * @param {number} star  現在の進化段階(★)
 * @param {number} level 現在のレベル
 */
export function resolveCharacter(idOrBase, star, level) {
  const base = typeof idOrBase === 'string' ? characterById(idOrBase) : idOrBase;
  if (!base) return null;
  const st = Math.max(base.rarity, Math.min(MAX_RARITY, star || base.rarity));
  const lv = Math.max(1, Math.min(maxLevelFor(st), level || 1));
  const evolved = st > base.rarity;

  const leaderSkill = evolved
    ? evolvedLeaderSkill(base.leaderSkillId, base.evoLeaderSkillId)
    : LEADER_SKILLS[base.leaderSkillId] || null;
  const skill = evolved
    ? evolvedActiveSkill(base.skillId, base.evoSkillId)
    : ACTIVE_SKILLS[base.skillId] || null;

  return {
    ...base,
    baseRarity: base.rarity,
    rarity: st,
    star: st,
    level: lv,
    maxLevel: maxLevelFor(st),
    evolved,
    name: evolved && base.evoName ? base.evoName : base.name,
    job: evolved && base.evoJob ? base.evoJob : base.job,
    atk: statAt(base.atk, base.rarity, st, lv),
    hp:  statAt(base.hp,  base.rarity, st, lv),
    rcv: statAt(base.rcv, base.rarity, st, lv),
    leaderSkill,
    skill,
    art: artStageFor(base, st, lv)
  };
}

/**
 * 進化できるか。
 * 各キャラクターの進化は1段階まで(★4のキャラだけが★5=URに到達できる)。
 */
export function canEvolveChar(base, star) {
  if (!base) return false;
  return star < Math.min(MAX_RARITY, base.rarity + 1);
}
/** 進化の到達点 */
export function finalStarOf(base) {
  return base ? Math.min(MAX_RARITY, base.rarity + 1) : MAX_RARITY;
}

/** オーラ×レアリティから代表キャラを引く(旧セーブの移行に使う) */
export function characterByAuraRarity(aura, rarity) {
  const r = Math.min(MAX_GACHA_RARITY, Math.max(1, rarity));
  return CHARACTERS.find(c => c.aura === aura && c.rarity === r && !c.featured)
      || CHARACTERS.find(c => c.aura === aura && c.rarity === r)
      || CHARACTERS.find(c => c.aura === aura)
      || CHARACTERS[0];
}

/* =========================================================
 * NPCサポート
 * フレンドがいなくてもサポート枠を必ず選べるようにするための助っ人。
 * プレイヤーランクで解放されていく。
 * =======================================================*/
export const NPC_SUPPORTS = [
  { uid: 'npc_guild',   name: 'ギルド受付 ロゼ',   icon: '🛎️', charId: 'fl_gald',    rank: 1,  level: 8 },
  { uid: 'npc_academy', name: '学院生 ティア',     icon: '📘', charId: 'aq_mio',     rank: 1,  level: 8 },
  { uid: 'npc_chapel',  name: '教会シスター ノエ', icon: '⛪', charId: 'lm_mina',    rank: 1,  level: 8 },
  { uid: 'npc_ranger',  name: '森番 グレン',       icon: '🌲', charId: 'wd_noa',     rank: 1,  level: 8 },
  { uid: 'npc_knight',  name: '近衛騎士 ロラン',   icon: '🛡️', charId: 'lm_gawain',  rank: 4,  level: 14 },
  { uid: 'npc_mage',    name: '宮廷魔術師 ヴェル', icon: '🔮', charId: 'aq_shirka',  rank: 6,  level: 18 },
  { uid: 'npc_archer',  name: '風の射手 ミラ',     icon: '🍃', charId: 'wd_el',      rank: 8,  level: 22 },
  { uid: 'npc_captain', name: '紅蓮隊長 ガイ',     icon: '⚔️', charId: 'fl_rune',    rank: 10, level: 24 },
  { uid: 'npc_priest',  name: '光明司祭 セルマ',   icon: '✨', charId: 'lm_elmina',  rank: 13, level: 28 },
  { uid: 'npc_sage',    name: '蒼海の賢者',        icon: '🌊', charId: 'aq_aqualis', rank: 16, level: 34 },
  { uid: 'npc_warden',  name: '世界樹の守人',      icon: '🌳', charId: 'wd_yggd',    rank: 20, level: 38 },
  { uid: 'npc_hero',    name: '英雄 イグナス',     icon: '🔥', charId: 'fl_ignis',   rank: 24, level: 40 },
  /* 進化済みの助っ人。高ランクで解放される */
  { uid: 'npc_kai',     name: '虚空剣のカイ',      icon: '🗡️', charId: 'aq_kai_x',   rank: 28, level: 50, star: 5 }
];

/** 現在のランクで選べるNPCサポートを返す */
export function availableNpcSupports(rank) {
  return NPC_SUPPORTS.filter(n => rank >= n.rank);
}
