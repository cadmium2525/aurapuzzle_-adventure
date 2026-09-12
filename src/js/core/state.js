/* =========================================================
 * state.js — セーブデータ / 編成 / スタミナ / ランク / 育成
 *
 * 所持キャラは { n:所持数, star:進化段階, lv:レベル, xp:経験値 } で保持し、
 * 画面・バトルは resolveCharacter() を通した形で扱う。
 * =======================================================*/
import { Store } from './storage.js';
import { uid } from './ui.js';
import {
  CHARACTERS, characterById, characterByAuraRarity, resolveCharacter,
  AWAKEN_MAX, awakenStepsFor, awakenModsFor,
  maxLevelFor, expToNextCharLevel, canEvolveChar, finalStarOf, MAX_RARITY, TEAM_SIZE,
  MATERIALS, crystalIdFor, evolveCostTo,
  STAMINA_REGEN_MS, STAMINA_BASE_MAX, STAMINA_PER_RANK, expToNextRank
} from '../data/gamedata.js';

const SAVE_KEY = 'acb_state';
const SAVE_VERSION = 6;

export const DEFAULT_ICONS = ['🙂', '🔥', '💧', '🌿', '💗', '🦸', '🧙', '👑', '🎩', '🐲'];

/** 初期編成:火/水/癒の3人でスタート */
const STARTER_IDS = ['fl_rito', 'aq_mio', 'lm_mina'];

/** 所持キャラ1件ぶんの初期値 */
function newEntry(charId) {
  const base = characterById(charId);
  return { n: 1, star: base ? base.rarity : 1, lv: 1, xp: 0, awa: 0 };
}

function emptyMaterials() {
  const m = {};
  MATERIALS.forEach(mt => { m[mt.id] = 0; });
  return m;
}

function createInitialState() {
  const owned = {};
  STARTER_IDS.forEach(id => { owned[id] = newEntry(id); });
  return {
    version: SAVE_VERSION,
    coin: 800, frepo: 0, orb: 15,
    rank: 1, exp: 0,
    stamina: STAMINA_BASE_MAX,
    staminaAt: Date.now(),
    characters: owned,                 // {charId: {n, star, lv, xp}}
    materials: emptyMaterials(),       // {materialId: 個数}
    team: STARTER_IDS.slice(),         // 自分の3人(先頭がリーダー)
    progress: {},                      // {stageId:{normal:bool, hard:bool}}
    records: {},                       // {stageId_diff:{maxChain}}
    grants: {},                        // 一度きりの付与の記録(再ログインで重複させない)
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
 * - v4 以前: モンスター(`c0_3` のようなID)→ 同じオーラ・レアリティの人物へ
 * - v5: 所持キャラが数値(所持数)だったので {n, star, lv, xp} へ
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
    const aura = Math.min(Number(m[1]), 3);
    const rarity = Math.max(1, Math.min(5, Number(m[2])));
    const ch = characterByAuraRarity(aura, rarity);
    return ch ? ch.id : null;
  };

  const ownedSrc = old.characters || old.monsters || {};
  const owned = {};
  Object.keys(ownedSrc).forEach(id => {
    const to = remapId(id);
    if (!to) return;
    const src = ownedSrc[id];
    const base = characterById(to);
    const entry = owned[to] || { n: 0, star: base.rarity, lv: 1, xp: 0, awa: 0 };
    if (typeof src === 'number') {
      entry.n += src;                       // v5 以前:所持数のみ
    } else if (src && typeof src === 'object') {
      entry.n += src.n || 1;
      entry.star = Math.max(entry.star, Math.min(finalStarOf(base), src.star || base.rarity));
      entry.lv = Math.max(entry.lv, src.lv || 1);
      entry.xp = src.xp || 0;
      entry.awa = Math.max(entry.awa || 0, Math.min(AWAKEN_MAX, src.awa || 0));
    }
    entry.lv = Math.min(entry.lv, maxLevelFor(entry.star));
    owned[to] = entry;
  });
  s.characters = Object.keys(owned).length ? owned : fresh.characters;
  delete s.monsters;

  s.materials = Object.assign(emptyMaterials(), old.materials || {});

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
  s.grants = old.grants || {};
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

/**
 * クラウドから取得したセーブでローカル保存を丸ごと置き換える(別端末での引き継ぎ用)。
 * migrate() を通すので、欠けている項目は初期値で補完され形式も現行に揃う。
 * 反映されるのは次回読み込みからなので、呼び出し側で location.reload() すること。
 */
export function replaceSavedState(raw) {
  Store.set(SAVE_KEY, migrate(raw || {}));
}
if (!loaded || loaded.version !== SAVE_VERSION) saveState();

/* ===================== 所持キャラ ===================== */
/** 所持データ(進化段階・レベル)を取り出す */
export function entryOf(charId) { return state.characters[charId] || null; }

/** レベル/進化を反映したキャラクターを返す(所持数と経験値も添える) */
export function resolveOwned(charId) {
  const e = entryOf(charId);
  if (!e) return null;
  const ch = resolveCharacter(charId, e.star, e.lv);
  if (!ch) return null;
  ch.xp = e.xp || 0;
  ch.count = e.n;
  ch.awaken = Math.min(AWAKEN_MAX, e.awa || 0);

  // 開眼ぶんを反映する。操作時間だけはパーティ単位なので party.js で合算する
  const mods = awakenModsFor(characterById(charId), ch.awaken);
  ch.awakenMods = mods;
  if (ch.awaken > 0) {
    ch.atk = Math.round(ch.atk * mods.atk);
    ch.hp  = Math.round(ch.hp  * mods.hp);
    ch.rcv = Math.round(ch.rcv * mods.rcv);
    if (ch.skill && mods.cdCut > 0) {
      ch.skill = { ...ch.skill, cooldown: Math.max(3, ch.skill.cooldown - mods.cdCut) };
    }
  }
  return ch;
}

/* ===================== 開眼 ===================== */
/**
 * 開眼の可否を返す。同じキャラを1体消費するので手持ちが2体以上必要。
 * @returns {{ok:boolean, reason:string, next:number, step:object|null}}
 */
export function awakenCheck(charId) {
  const e = entryOf(charId);
  const base = characterById(charId);
  if (!e || !base) return { ok: false, reason: '所持していません', next: 0, step: null };
  const cur = Math.min(AWAKEN_MAX, e.awa || 0);
  if (cur >= AWAKEN_MAX) return { ok: false, reason: '開眼は最大です', next: cur, step: null };
  const step = awakenStepsFor(base)[cur] || null;
  if ((e.n || 0) < 2) {
    return { ok: false, reason: '同じキャラクターがもう1体必要です', next: cur + 1, step };
  }
  return { ok: true, reason: '', next: cur + 1, step };
}

/**
 * 開眼を実行する(同キャラを1体消費)。
 * @returns {{ok:boolean, message:string, step?:object, to?:number}}
 */
export function awakenCharacter(charId) {
  const check = awakenCheck(charId);
  if (!check.ok) return { ok: false, message: check.reason };
  const e = entryOf(charId);
  e.n -= 1;
  e.awa = check.next;
  saveState();
  return { ok: true, message: '', step: check.step, to: check.next };
}

/** 自分の編成キャラ(空きスロットは除外) */
export function ownCharacters() {
  return state.team
    .filter(id => id && state.characters[id])
    .map(resolveOwned)
    .filter(Boolean);
}

/** 所持キャラの一覧(進化段階→レアリティ降順) */
export function ownedCharacters() {
  return Object.keys(state.characters)
    .filter(id => state.characters[id] && state.characters[id].n > 0)
    .map(resolveOwned)
    .filter(Boolean)
    .sort((a, b) => b.star - a.star || b.level - a.level || a.aura - b.aura
      || a.name.localeCompare(b.name, 'ja'));
}

export function addCharacter(id) {
  const base = characterById(id);
  if (!base) return null;
  const e = state.characters[id];
  if (e) e.n += 1; else state.characters[id] = newEntry(id);
  saveState();
  return state.characters[id];
}

/* ===================== キャラの育成 ===================== */
/**
 * 編成キャラに経験値を与える。
 * @returns {Array<{id:string, name:string, from:number, to:number, lv:number}>} レベルが上がったキャラ
 */
export function gainCharExp(charIds, amount) {
  const levelUps = [];
  charIds.forEach(id => {
    const e = state.characters[id];
    if (!e) return;
    const max = maxLevelFor(e.star);
    if (e.lv >= max) { e.xp = 0; return; }
    const before = e.lv;
    e.xp += amount;
    while (e.lv < max && e.xp >= expToNextCharLevel(e.lv)) {
      e.xp -= expToNextCharLevel(e.lv);
      e.lv++;
    }
    if (e.lv >= max) e.xp = 0;
    if (e.lv > before) {
      const ch = resolveOwned(id);
      levelUps.push({ id, name: ch ? ch.name : id, from: before, to: e.lv, lv: e.lv });
    }
  });
  saveState();
  return levelUps;
}

/** 素材を増やす。{materialId: 個数} を渡す */
export function addMaterials(drops) {
  Object.keys(drops || {}).forEach(id => {
    state.materials[id] = (state.materials[id] || 0) + drops[id];
  });
  saveState();
}

export function materialCount(id) { return state.materials[id] || 0; }

/**
 * 進化の可否と不足内容を返す。
 * @returns {{ok:boolean, reason:string, need:object, nextStar:number}}
 */
export function evolveCheck(charId) {
  const e = entryOf(charId);
  const base = characterById(charId);
  if (!e || !base) return { ok: false, reason: '所持していません', need: null, nextStar: 0 };
  if (!canEvolveChar(base, e.star)) {
    return { ok: false, reason: 'これ以上進化できません', need: null, nextStar: e.star };
  }

  const nextStar = e.star + 1;
  const cost = evolveCostTo(nextStar);
  const crystalId = crystalIdFor(base.aura);
  const need = {
    level: maxLevelFor(e.star),
    crystalId, crystal: cost.crystal, shard: cost.shard, coin: cost.coin
  };
  if (e.lv < need.level) {
    return { ok: false, reason: `レベルを${need.level}まで上げてください`, need, nextStar };
  }
  if (materialCount(crystalId) < cost.crystal || materialCount('mt_star') < cost.shard) {
    return { ok: false, reason: '素材が足りません', need, nextStar };
  }
  if (state.coin < cost.coin) return { ok: false, reason: 'コインが足りません', need, nextStar };
  return { ok: true, reason: '', need, nextStar };
}

/**
 * 進化を実行する。
 * @returns {{ok:boolean, message:string, before?:object, after?:object}}
 */
export function evolveCharacter(charId) {
  const check = evolveCheck(charId);
  if (!check.ok) return { ok: false, message: check.reason };
  const e = entryOf(charId);
  const before = resolveOwned(charId);
  state.materials[check.need.crystalId] -= check.need.crystal;
  state.materials.mt_star -= check.need.shard;
  state.coin -= check.need.coin;
  e.star = check.nextStar;
  e.xp = 0;
  // レベルは引き継ぐ(上限が伸びるので育て直しにはならない)
  e.lv = Math.min(e.lv, maxLevelFor(e.star));
  saveState();
  return { ok: true, message: '進化しました!', before, after: resolveOwned(charId) };
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
