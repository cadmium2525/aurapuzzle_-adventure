/* =========================================================
 * state.js — セーブデータ / 編成 / スタミナ / ランク / 育成
 *
 * 所持キャラは { n:所持数, star:進化段階, lv:レベル, xp:経験値,
 * awa:開眼段階, at:入手時刻 } で保持し、画面・バトルは resolveCharacter() を
 * 通した形で扱う。
 *
 * 編成は teams に5つのプリセットとして持ち、teamIndex が選択中のものを指す。
 * バトルへ出るのは activeTeam()、ホームに出るのは最後に出撃した lastTeam。
 * =======================================================*/
import { Store } from './storage.js';
import { uid } from './ui.js';
import {
  CHARACTERS, characterById, characterByAuraRarity, resolveCharacter,
  AWAKEN_MAX, awakenStepsFor, awakenMaxFor, awakenCopiesFor,
  maxLevelFor, expToNextCharLevel, canEvolveChar, finalStarOf, MAX_RARITY, TEAM_SIZE,
  MATERIALS, crystalIdFor, evolveCostTo, dismissRewardFor, awakenTokenCost, EXP_ITEMS,
  STAMINA_REGEN_MS, STAMINA_BASE_MAX, STAMINA_PER_RANK, expToNextRank
} from '../data/gamedata.js';

const SAVE_KEY = 'acb_state';
const SAVE_VERSION = 9;

export const DEFAULT_ICONS = ['🙂', '🔥', '💧', '🌿', '💗', '🦸', '🧙', '👑', '🎩', '🐲'];

/** 保存できる編成プリセットの数。ダンジョン出発時にこの中から選ぶ */
export const TEAM_PRESETS = 5;
/** プリセット1件ぶんの空の枠(先頭がリーダー) */
const emptyTeam = () => new Array(TEAM_SIZE).fill(null);

/** 初期編成:火/水/癒の3人でスタート */
const STARTER_IDS = ['fl_rito', 'aq_mio', 'lm_mina'];

/**
 * 所持キャラ1件ぶんの初期値。
 * at は「はじめて仲間にした時刻」。一覧の入手順ソートに使うので、
 * 同じキャラの2体目以降では更新しない(並びが勝手に動かないようにする)。
 */
function newEntry(charId) {
  const base = characterById(charId);
  return { n: 1, star: base ? base.rarity : 1, lv: 1, xp: 0, awa: 0, at: Date.now() };
}

function emptyMaterials() {
  const m = {};
  MATERIALS.forEach(mt => { m[mt.id] = 0; });
  return m;
}

/**
 * 与えられた編成をプリセット5枠に整える。
 * 足りないぶんは空のプリセットで埋め、各プリセットは TEAM_SIZE 個の枠を持つ。
 */
function teamPresetsFrom(list) {
  const out = [];
  for (let i = 0; i < TEAM_PRESETS; i++) {
    const src = Array.isArray(list[i]) ? list[i] : [];
    const team = emptyTeam();
    src.slice(0, TEAM_SIZE).forEach((id, j) => { team[j] = id || null; });
    out.push(team);
  }
  return out;
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
    characters: owned,                 // {charId: {n, star, lv, xp, awa, at}}
    materials: emptyMaterials(),       // {materialId: 個数}
    teams: teamPresetsFrom([STARTER_IDS.slice()]),  // 編成プリセット5つ(先頭がリーダー)
    teamIndex: 0,                      // いま選んでいるプリセット
    lastTeam: null,                    // 最後にダンジョンへ連れて行った3人(ホームの表示)
    progress: {},                      // {stageId:{normal:bool, hard:bool}}
    records: {},                       // {stageId_diff:{maxChain}}
    grants: {},                        // 一度きりの付与の記録(再ログインで重複させない)
    gifts: [],                         // プレゼントボックスの中身(未受け取り)
    giftLog: {},                       // 受け取り済みの運営プレゼントID
    login: { date: '', streak: 0 },    // 最後にログインボーナスを配った日と連続日数
    shopLog: { date: '', counts: {} }, // 1日に買える数に上限がある商品の、今日ぶんの購入数
    shopTotal: {},                     // 買い切り商品の通算購入数(日付では戻らない)
    settings: { bgm: 60, se: 80, playerId: uid(), homeThemeId: 'default' },
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
      entry.awa = Math.max(entry.awa || 0, Math.min(awakenMaxFor(base), src.awa || 0));
    }
    entry.lv = Math.min(entry.lv, maxLevelFor(entry.star));
    owned[to] = entry;
  });
  s.characters = Object.keys(owned).length ? owned : fresh.characters;
  delete s.monsters;

  s.materials = Object.assign(emptyMaterials(), old.materials || {});

  // v8 までは編成が1つ(old.team)だけだった。それを1番目のプリセットに移す。
  const cleanTeam = src => {
    const team = [];
    (Array.isArray(src) ? src : []).forEach(id => {
      const to = remapId(id);
      if (to && s.characters[to] && !team.includes(to)) team.push(to);
    });
    return team.slice(0, TEAM_SIZE);
  };
  const presets = Array.isArray(old.teams) && old.teams.length
    ? old.teams.map(cleanTeam)
    : [cleanTeam(old.team)];
  if (!presets[0].length) presets[0] = cleanTeam(STARTER_IDS);
  s.teams = teamPresetsFrom(presets);
  s.teamIndex = Math.max(0, Math.min(TEAM_PRESETS - 1, old.teamIndex || 0));
  s.lastTeam = cleanTeam(old.lastTeam);
  if (!s.lastTeam.length) s.lastTeam = null;
  delete s.team;

  // 入手順ソートのための時刻。移行前のデータには無いので0(いちばん古い)にする
  Object.keys(s.characters).forEach(id => {
    const e = s.characters[id];
    if (typeof e.at !== 'number') e.at = 0;
  });

  s.rank = old.rank || 1;
  s.exp = old.exp || 0;
  s.stamina = typeof old.stamina === 'number' ? old.stamina : maxStaminaFor(s.rank);
  // v7まではランクアップごとに最大値を丸ごと加算していたため、移行時に正常な上限へ戻す。
  if ((old.version || 0) < 8 && s.stamina > maxStaminaFor(s.rank)) {
    s.stamina = maxStaminaFor(s.rank);
  }
  s.staminaAt = old.staminaAt || Date.now();
  s.records = old.records || {};
  s.grants = old.grants || {};
  s.gifts = Array.isArray(old.gifts) ? old.gifts : [];
  s.giftLog = old.giftLog || {};
  s.login = Object.assign({ date: '', streak: 0 }, old.login || {});
  s.shopLog = Object.assign({ date: '', counts: {} }, old.shopLog || {});
  s.shopTotal = Object.assign({}, old.shopTotal || {});
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
  const ch = resolveCharacter(charId, e.star, e.lv, e.awa);
  if (!ch) return null;
  ch.xp = e.xp || 0;
  ch.count = e.n;
  ch.acquiredAt = e.at || 0;      // 一覧の入手順ソートに使う
  return ch;
}

/* ===================== 開眼 ===================== */
/**
 * 開眼の可否を返す。同じキャラを1体消費するので手持ちが2体以上必要。
 * @returns {{ok:boolean, reason:string, next:number, step:object|null}}
 */
export function awakenCheck(charId, useToken) {
  const e = entryOf(charId);
  const base = characterById(charId);
  if (!e || !base) return { ok: false, reason: '所持していません', next: 0, step: null, tokenCost: 0 };
  const cur = Math.min(awakenMaxFor(base), e.awa || 0);
  const tokenCost = awakenTokenCost(base.rarity);
  const copies = awakenCopiesFor(base,cur);
  const info = { next: cur + 1, step: awakenStepsFor(base)[cur] || null, tokenCost, copies };
  if (cur >= awakenMaxFor(base)) {
    return { ok: false, reason: '開眼は最大です', next: cur, step: null, tokenCost };
  }
  if (useToken) {
    if (base.raidDrop) return {ok:false,reason:'降臨キャラクターは同じキャラを集めて開眼します',...info};
    if (materialCount('mt_awaken') < tokenCost) {
      return { ok: false, reason: `開眼の証が${tokenCost}個必要です`, ...info };
    }
    return { ok: true, reason: '', ...info };
  }
  if ((e.n || 0) < copies + 1) {
    return { ok: false, reason: `同じキャラクターが素材として${copies}体必要です（本体は残ります）`, ...info };
  }
  return { ok: true, reason: '', ...info };
}

/**
 * 開眼を実行する(同キャラを1体消費)。
 * @returns {{ok:boolean, message:string, step?:object, to?:number}}
 */
export function awakenCharacter(charId, useToken) {
  const check = awakenCheck(charId, useToken);
  if (!check.ok) return { ok: false, message: check.reason };
  const e = entryOf(charId);
  if (useToken) state.materials.mt_awaken -= check.tokenCost;
  else e.n -= check.copies;
  e.awa = check.next;
  saveState();
  return { ok: true, message: '', step: check.step, to: check.next, usedToken: !!useToken };
}

/* ===================== 送還(手持ちを素材に戻す) ===================== */
/**
 * 送還1体ぶんの取り分。進化段階が高いほど戻りが大きい。
 * @returns {{materials:object, coin:number}}
 */
function dismissYield(charId, count) {
  const e = entryOf(charId);
  const base = characterById(charId);
  const r = dismissRewardFor(e.star);
  const materials = {};
  const add = (id, v) => { if (v > 0) materials[id] = (materials[id] || 0) + v * count; };
  add(crystalIdFor(base.aura), r.crystal);
  add('mt_star', r.shard);
  add('mt_awaken', r.awaken);
  return { materials, coin: r.coin * count };
}

/**
 * 送還できるか。指定した数まで手持ちから減らせるかを見る。
 * 全部送還すると図鑑からも外れるので、そのときは teams から抜く側で面倒を見る。
 * @param {string} charId
 * @param {number} [count] 送還する数(省略時は手持ち全部)
 */
export function dismissCheck(charId, count) {
  const e = entryOf(charId);
  const base = characterById(charId);
  if (!e || !base) {
    return { ok: false, reason: '所持していません', count: 0, max: 0, reward: null, inTeam: false };
  }
  const max = e.n || 0;
  const n = Math.max(1, Math.min(Number.isFinite(count) ? count : max, max));
  const info = {
    count: n, max,
    reward: dismissRewardFor(e.star),
    total: dismissYield(charId, n),
    // 全部送還すると編成から消えるので、呼び出し側が確認を出せるように知らせる
    inTeam: n >= max && teamsWith(charId).length > 0
  };
  if (max < 1) return { ok: false, reason: '所持していません', ...info };
  return { ok: true, reason: '', ...info };
}

/** そのキャラが入っているプリセットの番号 */
export function teamsWith(charId) {
  const out = [];
  for (let i = 0; i < TEAM_PRESETS; i++) if (teamAt(i).includes(charId)) out.push(i);
  return out;
}

/** 手持ちからいなくなったキャラを編成・貸し出しから外す */
function forgetCharacter(charId) {
  for (let i = 0; i < TEAM_PRESETS; i++) {
    const team = teamAt(i);
    team.forEach((id, slot) => { if (id === charId) team[slot] = null; });
  }
  if (Array.isArray(state.lastTeam)) {
    state.lastTeam = state.lastTeam.filter(id => id !== charId);
    if (!state.lastTeam.length) state.lastTeam = null;
  }
  if (state.profile.rentalCharId === charId) state.profile.rentalCharId = null;
}

/**
 * 指定した数だけ送還して素材に変える。
 * @returns {{ok:boolean, message:string, gained?:object, coin?:number, count?:number}}
 */
export function dismissCharacter(charId, count) {
  return dismissMany([{ id: charId, count }]);
}

/**
 * まとめて送還する。1件ずつ呼ぶより、獲得素材を1回の表示にまとめられる。
 * @param {Array<{id:string, count:number}>} picks
 */
export function dismissMany(picks) {
  const gained = {};
  let coin = 0;
  let count = 0;
  const names = [];
  (picks || []).forEach(pick => {
    const check = dismissCheck(pick.id, pick.count);
    if (!check.ok) return;
    const e = entryOf(pick.id);
    const base = characterById(pick.id);
    e.n -= check.count;
    count += check.count;
    names.push(base.name);
    Object.keys(check.total.materials).forEach(id => {
      const v = check.total.materials[id];
      state.materials[id] = (state.materials[id] || 0) + v;
      gained[id] = (gained[id] || 0) + v;
    });
    coin += check.total.coin;
    if (e.n <= 0) { delete state.characters[pick.id]; forgetCharacter(pick.id); }
  });
  state.coin += coin;
  saveState();
  if (!count) return { ok: false, message: '送還できるキャラクターがいません' };
  return { ok: true, message: '', gained, coin, count, names };
}

/* ===================== 経験値アイテム ===================== */
/**
 * 経験値アイテムを使って1体に経験値を与える。
 * ダンジョンに連れて行かなくても育てられるようにするための経路。
 */
export function useExpItem(charId, itemId, count) {
  const e = entryOf(charId);
  const per = EXP_ITEMS[itemId];
  if (!e || !per) return { ok: false, message: '使えません' };
  const have = materialCount(itemId);
  const use = Math.max(1, Math.min(count || 1, have));
  if (have < 1) return { ok: false, message: 'アイテムがありません' };
  if (e.lv >= maxLevelFor(e.star)) return { ok: false, message: 'レベルが上限です' };

  state.materials[itemId] -= use;
  const before = e.lv;
  const ups = gainCharExp([charId], per * use);
  saveState();
  return { ok: true, message: '', used: use, exp: per * use, from: before, to: e.lv, levelUps: ups };
}

/* ===================== 編成プリセット ===================== */
/** index 番目のプリセット(常に TEAM_SIZE 個の枠を持つ配列) */
export function teamAt(index) {
  const team = state.teams[index];
  if (Array.isArray(team) && team.length === TEAM_SIZE) return team;
  state.teams[index] = teamPresetsFrom([team || []])[0];
  return state.teams[index];
}

/** いま選んでいるプリセット */
export function activeTeam() { return teamAt(state.teamIndex); }

/** 編成画面で開くプリセットを切り替える */
export function setTeamIndex(index) {
  state.teamIndex = Math.max(0, Math.min(TEAM_PRESETS - 1, index | 0));
  saveState();
}

/**
 * プリセットの枠にキャラを入れる(null で空にする)。
 * 同じキャラが別の枠にいたら、その枠と入れ替える。編成のたびに
 * 前の枠を手で外さずに済むようにするための扱い。
 */
export function setTeamSlot(index, slot, charId) {
  const team = teamAt(index);
  if (slot < 0 || slot >= TEAM_SIZE) return team;
  if (charId) {
    const from = team.indexOf(charId);
    if (from >= 0 && from !== slot) team[from] = team[slot];
  }
  team[slot] = charId || null;
  saveState();
  return team;
}

/** プリセット内で枠を入れ替える(先頭がリーダー) */
export function swapTeamSlots(index, a, b) {
  const team = teamAt(index);
  if (a < 0 || b < 0 || a >= TEAM_SIZE || b >= TEAM_SIZE) return team;
  [team[a], team[b]] = [team[b], team[a]];
  saveState();
  return team;
}

/** そのプリセットの編成キャラ(空き枠は除外) */
export function charactersOfTeam(index) {
  return teamAt(index)
    .filter(id => id && state.characters[id])
    .map(resolveOwned)
    .filter(Boolean);
}

/** 自分の編成キャラ(空きスロットは除外)。バトルへ連れて行くのはこれ */
export function ownCharacters() {
  return charactersOfTeam(state.teamIndex);
}

/**
 * 最後にダンジョンへ連れて行った3人を覚えておく。
 * ホーム画面はこれを1枚絵で見せる(編成を触っただけでは変わらない)。
 */
export function rememberLastTeam(charIds) {
  const ids = (charIds || []).filter(Boolean).slice(0, TEAM_SIZE);
  state.lastTeam = ids.length ? ids : null;
  saveState();
}

/** ホームに出す編成。未出撃なら選択中のプリセットで代用する */
export function homeCharacters() {
  const ids = (state.lastTeam || []).filter(id => state.characters[id]);
  if (!ids.length) return ownCharacters();
  return ids.map(resolveOwned).filter(Boolean);
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

/* ===================== ショップの購入制限 ===================== */
/** YYYY-MM-DD。日をまたいだかどうかの判定に使う */
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 今日ぶんの記録。日付が変わっていたら捨てて作り直す(古い日は溜めない) */
function shopLogToday() {
  const today = todayStr();
  if (!state.shopLog || state.shopLog.date !== today) state.shopLog = { date: today, counts: {} };
  return state.shopLog;
}

/** その商品を今日いくつ買ったか */
export function shopBoughtToday(itemId) { return shopLogToday().counts[itemId] || 0; }

/** 今日あと何個買えるか(上限のない商品は Infinity) */
export function shopRemainingToday(item) {
  if (!item.dailyLimit) return Infinity;
  return Math.max(0, item.dailyLimit - shopBoughtToday(item.id));
}

/**
 * その商品をこれまでに何個買ったか(買い切り商品用。日付では戻らない)。
 * v9 のまま項目を足しているので、古いセーブに無くても困らないようにする。
 */
export function shopBoughtTotal(itemId) {
  return (state.shopTotal && state.shopTotal[itemId]) || 0;
}

/** 買い切り商品の残り(買い切りでなければ Infinity) */
export function shopRemainingTotal(item) {
  if (!item.totalLimit) return Infinity;
  return Math.max(0, item.totalLimit - shopBoughtTotal(item.id));
}

/** 今日この商品を買える数。日ぶんと買い切りぶんの厳しいほう */
export function shopRemaining(item) {
  return Math.min(shopRemainingToday(item), shopRemainingTotal(item));
}

/** 購入を1つ記録する。上限の種類に応じて日ぶん/通算ぶんの両方を進める */
export function recordShopPurchase(item) {
  if (item.dailyLimit) {
    const log = shopLogToday();
    log.counts[item.id] = (log.counts[item.id] || 0) + 1;
  }
  if (item.totalLimit) {
    if (!state.shopTotal) state.shopTotal = {};
    state.shopTotal[item.id] = (state.shopTotal[item.id] || 0) + 1;
  }
  saveState();
}

/* ===================== ランク ===================== */
export function maxStaminaFor(rank) {
  return STAMINA_BASE_MAX + (rank - 1) * STAMINA_PER_RANK;
}
export function maxStamina() { return maxStaminaFor(state.rank); }

/**
 * 経験値を加算する。
 * ランクアップ時は新しい最大値まで回復する。最大値を丸ごと加算しない。
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
    const newMax = maxStaminaFor(state.rank);
    const bonus = Math.max(0, newMax - state.stamina);
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
