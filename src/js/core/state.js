/* =========================================================
 * state.js — セーブデータ / 編成 / スタミナ / ランク
 * =======================================================*/
import { Store } from './storage.js';
import { uid } from './ui.js';
import {
  AURAS, CHARACTERS, characterById, characterByAuraRarity, TEAM_SIZE,
  STAMINA_REGEN_MS, STAMINA_BASE_MAX, STAMINA_PER_RANK, expToNextRank
} from '../data/gamedata.js';

const SAVE_KEY = 'acb_state';
const SAVE_VERSION = 5;

export const DEFAULT_ICONS = ['🙂', '🔥', '💧', '🌿', '💗', '🦸', '🧙', '👑', '🎩', '🐲'];

/** 初期編成:火/水/癒の3人でスタート */
const STARTER_IDS = ['fl_rito', 'aq_mio', 'lm_mina'];

function createInitialState() {
  const owned = {};
  STARTER_IDS.forEach(id => { owned[id] = 1; });
  return {
    version: SAVE_VERSION,
    coin: 800, frepo: 0, orb: 15,
    rank: 1, exp: 0,
    stamina: STAMINA_BASE_MAX,
    staminaAt: Date.now(),
    characters: owned,                 // {charId: 所持数}
    team: STARTER_IDS.slice(),         // 自分の3人(先頭がリーダー)
    progress: {},                      // {stageId:{normal:bool, hard:bool}}
    records: {},                       // {stageId_diff:{maxChain}}
    settings: { bgm: 60, se: 80, playerId: uid() },
    profile: {
      name: 'プレイヤー',
      icon: DEFAULT_ICONS[0],
      friends: [],                     // [{uid, name, icon, code, addedAt, lastGreetDate}]
      rentalCharId: null               // フレンドに貸し出すキャラクター
    }
  };
}

/**
 * 旧セーブを現行フォーマットへ移行する。
 * v4 以前はモンスター(`c0_3` のような ID)だったので、
 * 同じオーラ・レアリティの人物キャラクターへ読み替える。
 */
function migrate(old) {
  const fresh = createInitialState();
  const s = Object.assign(fresh, old);
  s.version = SAVE_VERSION;

  const validIds = new Set(CHARACTERS.map(c => c.id));
  const remapId = id => {
    if (!id) return null;
    if (validIds.has(id)) return id;
    const m = /^c(\d)_(\d)$/.exec(id);
    if (!m) return null;
    // 旧 光(c3)/闇(c4) はどちらも癒(index 3)へ集約する
    const aura = Math.min(Number(m[1]), AURAS.length - 1);
    const rarity = Math.max(1, Math.min(5, Number(m[2])));
    const ch = characterByAuraRarity(aura, rarity);
    return ch ? ch.id : null;
  };

  const ownedSrc = old.characters || old.monsters || {};
  const owned = {};
  Object.keys(ownedSrc).forEach(id => {
    const to = remapId(id);
    if (!to) return;
    owned[to] = (owned[to] || 0) + (ownedSrc[id] || 0);
  });
  s.characters = Object.keys(owned).length ? owned : fresh.characters;
  delete s.monsters;

  const team = [];
  (old.team || []).forEach(id => {
    const to = remapId(id);
    if (to && s.characters[to] && !team.includes(to)) team.push(to);
  });
  s.team = team.slice(0, TEAM_SIZE);
  while (s.team.length < TEAM_SIZE) s.team.push(null);

  s.rank = old.rank || 1;
  s.exp = old.exp || 0;
  s.stamina = typeof old.stamina === 'number' ? old.stamina : maxStaminaFor(s.rank);
  s.staminaAt = old.staminaAt || Date.now();
  s.records = old.records || {};
  s.settings = Object.assign(fresh.settings, old.settings || {});
  s.profile = Object.assign(fresh.profile, old.profile || {});
  s.profile.friends = Array.isArray(s.profile.friends) ? s.profile.friends : [];
  s.profile.rentalCharId =
    remapId((old.profile && (old.profile.rentalCharId || old.profile.rentalMonsterId)) || null);
  return s;
}

let loaded = Store.get(SAVE_KEY, null);
export const state = (loaded && loaded.version === SAVE_VERSION)
  ? loaded
  : (loaded ? migrate(loaded) : createInitialState());

const saveListeners = [];
/** saveState() のたびに実行するコールバックを登録する(クラウド同期用) */
export function onSave(fn) { saveListeners.push(fn); }

export function saveState() {
  Store.set(SAVE_KEY, state);
  saveListeners.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
}
export function resetState() { Store.set(SAVE_KEY, null); }
if (!loaded || loaded.version !== SAVE_VERSION) saveState();

/* ===================== 編成 ===================== */
/** 自分の編成キャラ(空きスロットは除外) */
export function ownCharacters() {
  return state.team
    .filter(id => id && state.characters[id])
    .map(characterById)
    .filter(Boolean);
}

/** 所持キャラの一覧(レアリティ降順) */
export function ownedCharacters() {
  return Object.keys(state.characters)
    .filter(id => state.characters[id] > 0)
    .map(characterById)
    .filter(Boolean)
    .sort((a, b) => b.rarity - a.rarity || a.aura - b.aura || a.name.localeCompare(b.name, 'ja'));
}

export function addCharacter(id) {
  state.characters[id] = (state.characters[id] || 0) + 1;
  saveState();
}

/* ===================== ランク ===================== */
export function maxStaminaFor(rank) {
  return STAMINA_BASE_MAX + (rank - 1) * STAMINA_PER_RANK;
}
export function maxStamina() { return maxStaminaFor(state.rank); }

/**
 * 経験値を加算する。
 * ランクアップ時は「現在のスタミナ + ランクアップ後の最大スタミナ」を加算するので、
 * スタミナが最大値を超えてオーバーフローする。
 * @returns {{ups:number, staminaGained:number}}
 */
export function gainExp(amount) {
  state.exp += amount;
  let ups = 0;
  let staminaGained = 0;
  while (state.exp >= expToNextRank(state.rank)) {
    state.exp -= expToNextRank(state.rank);
    state.rank++;
    ups++;
    const bonus = maxStaminaFor(state.rank);   // ランクアップ後の最大スタミナぶんを上乗せ
    state.stamina += bonus;
    staminaGained += bonus;
  }
  if (ups > 0) state.staminaAt = Date.now();
  saveState();
  return { ups, staminaGained };
}

/* ===================== スタミナ ===================== */
/**
 * 経過時間ぶんのスタミナを回復させる(3分で1回復)。
 * ランクアップのオーバーフロー分は削らず、最大値を超えた状態を維持する。
 */
export function tickStamina() {
  const max = maxStamina();
  const now = Date.now();
  if (state.stamina >= max) {
    // 最大値以上(オーバーフロー中)は自然回復しないが、値も減らさない
    state.staminaAt = now;
    return;
  }
  const elapsed = now - (state.staminaAt || now);
  if (elapsed < 0) { state.staminaAt = now; return; }
  const gained = Math.floor(elapsed / STAMINA_REGEN_MS);
  if (gained > 0) {
    state.stamina = Math.min(max, state.stamina + gained);
    state.staminaAt = (state.stamina >= max) ? now : state.staminaAt + gained * STAMINA_REGEN_MS;
    saveState();
  }
}

/** 次の1回復までの残りミリ秒(満タン/オーバーフロー中は0) */
export function staminaNextInMs() {
  if (state.stamina >= maxStamina()) return 0;
  const elapsed = Date.now() - (state.staminaAt || Date.now());
  return Math.max(0, STAMINA_REGEN_MS - (elapsed % STAMINA_REGEN_MS));
}

export function hasStamina(cost) {
  tickStamina();
  return state.stamina >= cost;
}

export function spendStamina(cost) {
  tickStamina();
  if (state.stamina < cost) return false;
  // 満タン(以上)から減った瞬間に自然回復の計測を開始する
  if (state.stamina >= maxStamina()) state.staminaAt = Date.now();
  state.stamina -= cost;
  saveState();
  return true;
}
