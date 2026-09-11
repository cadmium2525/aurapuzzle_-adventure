/* =========================================================
 * state.js — セーブデータ / チーム / スタミナ / ランク
 * =======================================================*/
import { Store } from './storage.js';
import { uid } from './ui.js';
import {
  ELEMENTS, MONSTER_POOL, monsterById, TEAM_SIZE,
  STAMINA_REGEN_MS, STAMINA_BASE_MAX, STAMINA_PER_RANK, expToNextRank
} from '../data/gamedata.js';

const SAVE_KEY = 'acb_state';
const SAVE_VERSION = 4;

const DEFAULT_ICONS = ['🙂', '🔥', '💧', '🌿', '💗', '🐲', '🦸', '🧙', '🎩', '👑'];

function createInitialState() {
  const starter = {};
  ELEMENTS.forEach(el => { starter[el.key + '_1'] = 1; });
  return {
    version: SAVE_VERSION,
    coin: 800, frepo: 0, orb: 15,
    rank: 1, exp: 0,
    stamina: STAMINA_BASE_MAX,
    staminaAt: Date.now(),
    monsters: starter,
    team: ELEMENTS.slice(0, TEAM_SIZE).map(el => el.key + '_1'),
    progress: {},                      // {stageId:{normal:bool, hard:bool}}
    records: {},                       // {stageId_diff:{maxChain, turns}}
    settings: { bgm: 60, se: 80, playerId: uid() },
    // フレンドシステム用のプロフィール(playerId=フレンドコードとして流用)
    profile: {
      name: 'プレイヤー',
      icon: DEFAULT_ICONS[0],
      friends: [],                     // [{uid, name, icon, addedAt, lastGreetDate}]
      rentalMonsterId: null            // フレンドに貸し出すレンタルモンスター
    }
  };
}
export { DEFAULT_ICONS };

/**
 * 旧セーブ(5属性 / 3体編成)を現行フォーマットへ移行する。
 * 旧 c3=光, c4=闇 → 現行 c3=癒(ピンク)へ集約する。
 */
function migrate(old) {
  const fresh = createInitialState();
  const s = Object.assign(fresh, old);
  s.version = SAVE_VERSION;

  const validIds = new Set(MONSTER_POOL.map(m => m.id));
  const remapId = id => {
    if (validIds.has(id)) return id;
    const m = /^c(\d)_(\d)$/.exec(id || '');
    if (!m) return null;
    const rarity = m[2];
    // 旧 光(c3) / 闇(c4) はどちらもピンク(c3)へ
    const mapped = `c3_${rarity}`;
    return validIds.has(mapped) ? mapped : null;
  };

  const monsters = {};
  Object.keys(old.monsters || {}).forEach(id => {
    const to = remapId(id);
    if (!to) return;
    monsters[to] = (monsters[to] || 0) + (old.monsters[id] || 0);
  });
  s.monsters = Object.keys(monsters).length ? monsters : fresh.monsters;

  const team = [];
  (old.team || []).forEach(id => {
    const to = remapId(id);
    if (to && s.monsters[to] && !team.includes(to)) team.push(to);
  });
  s.team = team.slice(0, TEAM_SIZE);

  s.rank = old.rank || 1;
  s.exp = old.exp || 0;
  s.stamina = typeof old.stamina === 'number' ? old.stamina : maxStaminaFor(s.rank);
  s.staminaAt = old.staminaAt || Date.now();
  s.records = old.records || {};
  s.settings = Object.assign(fresh.settings, old.settings || {});
  s.profile = Object.assign(fresh.profile, old.profile || {});
  s.profile.friends = Array.isArray(s.profile.friends) ? s.profile.friends : [];
  s.profile.rentalMonsterId = (old.profile && old.profile.rentalMonsterId) || null;
  // 編成は自分3体+フレンド1体の計4体に変更。既存セーブの4体編成は先頭3体に切り詰める。
  s.team = (s.team || []).slice(0, TEAM_SIZE);
  while (s.team.length < TEAM_SIZE) s.team.push(null);
  return s;
}

let loaded = Store.get(SAVE_KEY, null);
export const state = (loaded && loaded.version === SAVE_VERSION)
  ? loaded
  : (loaded ? migrate(loaded) : createInitialState());

const saveListeners = [];
/** state.save() が呼ばれるたびに実行するコールバックを登録する(クラウド同期用) */
export function onSave(fn) { saveListeners.push(fn); }

export function saveState() {
  Store.set(SAVE_KEY, state);
  saveListeners.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
}
export function resetState() { Store.set(SAVE_KEY, null); }
if (!loaded || loaded.version !== SAVE_VERSION) saveState();

/* ===================== チーム ===================== */
/**
 * @param {object|null} friendMonster フレンドから借りた4体目のモンスター(任意)
 */
export function getTeamStats(friendMonster) {
  const mons = state.team
    .filter(id => id && state.monsters[id])
    .map(monsterById)
    .filter(Boolean);
  const battleMons = friendMonster ? [...mons, friendMonster] : mons.slice();
  return {
    mons: battleMons,
    ownMons: mons,
    friendMon: friendMonster || null,
    maxHP: 100 + battleMons.reduce((s, m) => s + m.hp, 0),
    atkMult: 1 + battleMons.reduce((s, m) => s + m.atk, 0) / 100,
    leaderElement: mons.length ? mons[0].element : null
  };
}

export function addMonster(id) {
  state.monsters[id] = (state.monsters[id] || 0) + 1;
  saveState();
}

/* ===================== ランク ===================== */
export function maxStaminaFor(rank) {
  return STAMINA_BASE_MAX + (rank - 1) * STAMINA_PER_RANK;
}
export function maxStamina() { return maxStaminaFor(state.rank); }

/**
 * 経験値を加算する。ランクアップ時はスタミナ上限アップ+全回復。
 * @returns {number} 上がったランク数
 */
export function gainExp(amount) {
  state.exp += amount;
  let ups = 0;
  while (state.exp >= expToNextRank(state.rank)) {
    state.exp -= expToNextRank(state.rank);
    state.rank++;
    ups++;
  }
  if (ups > 0) {
    state.stamina = maxStamina();     // ランクアップでスタミナ全回復
    state.staminaAt = Date.now();
  }
  saveState();
  return ups;
}

/* ===================== スタミナ ===================== */
/** 経過時間ぶんのスタミナを回復させる(3分で1回復)。 */
export function tickStamina() {
  const max = maxStamina();
  const now = Date.now();
  if (state.stamina >= max) {
    state.stamina = Math.min(state.stamina, max);
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

/** 次の1回復までの残りミリ秒(満タンなら0) */
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
  if (state.stamina >= maxStamina()) state.staminaAt = Date.now();  // 満タンから減った瞬間に計測開始
  state.stamina -= cost;
  saveState();
  return true;
}
