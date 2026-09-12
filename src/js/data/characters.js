/* =========================================================
 * characters.js — オーラ(属性)と、自陣に編成する「人物」キャラクター
 *
 * 自陣はモンスターではなく人物。各キャラクターは固有のオーラを持ち、
 * バトルでは「自分のオーラを消したときだけ」攻撃する。
 * =======================================================*/
import { LEADER_SKILLS, ACTIVE_SKILLS } from './skills.js';

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

export const RARITY_TITLE = { 1: 'N', 2: 'R', 3: 'SR', 4: 'SSR', 5: 'UR' };
export const RARITY_HEX   = { 1: '#9AA7C7', 2: '#69C6F0', 3: '#B189FF', 4: '#FFC44D', 5: '#FF7BD5' };

/** レアリティごとの基準ステータス */
const RARITY_BASE = {
  1: { atk: 8,  hp: 14, rcv: 6  },
  2: { atk: 14, hp: 24, rcv: 9  },
  3: { atk: 22, hp: 38, rcv: 13 },
  4: { atk: 34, hp: 56, rcv: 18 },
  5: { atk: 50, hp: 80, rcv: 25 }
};
/** 役割ごとのステータス補正 */
const ROLE_WEIGHT = {
  attacker: { atk: 1.25, hp: 0.85, rcv: 0.7 },
  balance:  { atk: 1.00, hp: 1.00, rcv: 1.0 },
  tank:     { atk: 0.80, hp: 1.35, rcv: 0.9 },
  healer:   { atk: 0.70, hp: 0.95, rcv: 1.7 }
};
export const ROLE_LABEL = { attacker: 'アタッカー', balance: 'バランス', tank: 'タンク', healer: 'ヒーラー' };

/**
 * キャラクター1体を組み立てる。
 * @param {string} id 一意なID(セーブデータに保存される)
 */
function mk(id, name, job, portrait, aura, rarity, role, ls, sk) {
  const base = RARITY_BASE[rarity];
  const w = ROLE_WEIGHT[role];
  return {
    id, name, job, portrait,
    aura,                      // AURAS のインデックス
    rarity, role,
    atk: Math.round(base.atk * w.atk),
    hp:  Math.round(base.hp  * w.hp),
    rcv: Math.round(base.rcv * w.rcv),
    leaderSkillId: ls,
    skillId: sk
  };
}

/* --- キャラクター図鑑(全24人) --- */
export const CHARACTERS = [
  /* ===== 火 ===== */
  mk('fl_rito',   'リト',       '見習い剣士',   '🧑‍🎤', 0, 1, 'balance',  'ls_novice',  'sk_novice_time'),
  mk('fl_gald',   'ガルド',     '傭兵',         '🧔',   0, 2, 'attacker', 'ls_ember',   'sk_strike'),
  mk('fl_aina',   'アイナ',     '紅蓮の剣士',   '👩‍🦰', 0, 3, 'attacker', 'ls_blaze',   'sk_flamewave'),
  mk('fl_belg',   'ベルグ',     '砲術士',       '🧑‍🚒', 0, 3, 'balance',  'ls_burst',   'sk_warcry'),
  mk('fl_rune',   'ルネ',       '焔姫',         '👸',   0, 4, 'attacker', 'ls_inferno', 'sk_ember_time'),
  mk('fl_ignis',  'イグナス',   '業火の英雄',   '🦸',   0, 5, 'attacker', 'ls_ignis',   'sk_ignition'),

  /* ===== 水 ===== */
  mk('aq_mio',    'ミオ',       '水練生',       '🧒',   1, 1, 'balance',  'ls_ripple',  'sk_calm'),
  mk('aq_kai',    'カイ',       '潮風の斥候',   '🧑‍✈️', 1, 2, 'balance',  'ls_scout',   'sk_delay'),
  mk('aq_shirka', 'シルカ',     '氷結術士',     '🧙‍♀️', 1, 3, 'balance',  'ls_frost',   'sk_freeze'),
  mk('aq_reina',  'レイナ',     '波乗り',       '🏄‍♀️', 1, 3, 'attacker', 'ls_tide',    'sk_aqua_conv'),
  mk('aq_nereid', 'ネレイド',   '深海の守護者', '🧜‍♀️', 1, 4, 'tank',     'ls_abyss',   'sk_barrier'),
  mk('aq_aqualis','アクアリス', '蒼海の賢者',   '🧙',   1, 5, 'balance',  'ls_aquaris', 'sk_maelstrom'),

  /* ===== 木 ===== */
  mk('wd_noa',    'ノア',       '森の狩人',     '🧑‍🌾', 2, 1, 'balance',  'ls_sprout',  'sk_hunt'),
  mk('wd_hami',   'ハーミ',     '薬草師',       '👩‍⚕️', 2, 2, 'healer',   'ls_herb',    'sk_heal_s'),
  mk('wd_zeek',   'ジーク',     '樹護士',       '🧑‍🔧', 2, 3, 'tank',     'ls_guard',   'sk_wood_conv'),
  mk('wd_el',     'エル',       '風読みの射手', '🏹',   2, 3, 'attacker', 'ls_wind',    'sk_wind_time'),
  mk('wd_leafia', 'リーフィア', '大樹の巫女',   '🧝‍♀️', 2, 4, 'healer',   'ls_herb',    'sk_heal_l'),
  mk('wd_yggd',   'ユグド',     '世界樹の守人', '🧝',   2, 5, 'balance',  'ls_yggd',    'sk_forest'),

  /* ===== 癒 ===== */
  mk('lm_mina',   'ミナ',       '見習い聖女',   '👧',   3, 1, 'healer',   'ls_pray',    'sk_heal_m'),
  mk('lm_sera',   'セラ',       '祈祷師',       '🧕',   3, 2, 'tank',     'ls_vow',     'sk_heal_m'),
  mk('lm_lily',   'リリィ',     '白の癒し手',   '👩‍🦳', 3, 3, 'healer',   'ls_bless',   'sk_light'),
  mk('lm_gawain', 'ガウェイン', '聖騎士',       '🤴',   3, 3, 'tank',     'ls_paladin', 'sk_holy_guard'),
  mk('lm_elmina', 'エルミナ',   '光明の司祭',   '👰',   3, 4, 'healer',   'ls_bless',   'sk_grace'),
  mk('lm_aurora', 'アウロラ',   '大聖女',       '👼',   3, 5, 'healer',   'ls_aurora',  'sk_miracle')
];

const BY_ID = new Map(CHARACTERS.map(c => [c.id, c]));
export function characterById(id) { return BY_ID.get(id) || null; }

export function leaderSkillOf(ch) { return ch ? LEADER_SKILLS[ch.leaderSkillId] || null : null; }
export function skillOf(ch) { return ch ? ACTIVE_SKILLS[ch.skillId] || null : null; }

/** オーラ×レアリティから代表キャラを引く(旧セーブの移行に使う) */
export function characterByAuraRarity(aura, rarity) {
  return CHARACTERS.find(c => c.aura === aura && c.rarity === rarity)
      || CHARACTERS.find(c => c.aura === aura)
      || CHARACTERS[0];
}

/* =========================================================
 * NPCサポート
 * フレンドがいなくてもサポート枠を必ず選べるようにするための助っ人。
 * プレイヤーランクで解放されていく。
 * =======================================================*/
export const NPC_SUPPORTS = [
  { uid: 'npc_guild',   name: 'ギルド受付 ロゼ',  icon: '🛎️', charId: 'fl_gald',    rank: 1  },
  { uid: 'npc_academy', name: '学院生 ティア',    icon: '📘', charId: 'aq_mio',     rank: 1  },
  { uid: 'npc_chapel',  name: '教会シスター ノエ', icon: '⛪', charId: 'lm_mina',    rank: 1  },
  { uid: 'npc_ranger',  name: '森番 グレン',      icon: '🌲', charId: 'wd_noa',     rank: 1  },
  { uid: 'npc_knight',  name: '近衛騎士 ロラン',  icon: '🛡️', charId: 'lm_gawain',  rank: 4  },
  { uid: 'npc_mage',    name: '宮廷魔術師 ヴェル', icon: '🔮', charId: 'aq_shirka',  rank: 6  },
  { uid: 'npc_archer',  name: '風の射手 ミラ',    icon: '🍃', charId: 'wd_el',      rank: 8  },
  { uid: 'npc_captain', name: '紅蓮隊長 ガイ',    icon: '⚔️', charId: 'fl_rune',    rank: 10 },
  { uid: 'npc_priest',  name: '光明司祭 セルマ',  icon: '✨', charId: 'lm_elmina',  rank: 13 },
  { uid: 'npc_sage',    name: '蒼海の賢者',       icon: '🌊', charId: 'aq_aqualis', rank: 16 },
  { uid: 'npc_warden',  name: '世界樹の守人',     icon: '🌳', charId: 'wd_yggd',    rank: 20 },
  { uid: 'npc_hero',    name: '英雄 イグナス',    icon: '🔥', charId: 'fl_ignis',   rank: 24 }
];

/** 現在のランクで選べるNPCサポートを返す */
export function availableNpcSupports(rank) {
  return NPC_SUPPORTS.filter(n => rank >= n.rank);
}
