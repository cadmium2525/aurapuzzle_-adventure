/* =========================================================
 * party.js — 出撃パーティの組み立てとリーダースキルの合成
 *
 * リーダースキルは「自陣リーダー(編成1番目)」と「サポート枠のキャラクター」の
 * 2つだけが発動する。ここで2つの効果を合成して1つの修正値にまとめる。
 * =======================================================*/
import {
  COLORS, MATCH_MIN_DEFAULT,
  BASE_PARTY_HP, BASE_DRAG_TIME, MAX_DRAG_TIME
} from '../data/gamedata.js';
import { ownCharacters } from '../core/state.js';

/** 効果なしの初期値 */
function emptyMods() {
  const auraAtk = {};
  COLORS.forEach(k => { auraAtk[k] = 1; });
  return {
    auraAtk, allAtk: 1, hp: 1, rcv: 1,
    timeMs: 0, damageCut: 0, matchMin: null,
    comboAtk: []                    // [{combo, mult}]
  };
}

/** リーダースキル1つぶんを修正値へ合成する */
function applyLeaderSkill(mods, ls) {
  if (!ls) return mods;
  if (ls.auraAtk) Object.keys(ls.auraAtk).forEach(k => { mods.auraAtk[k] *= ls.auraAtk[k]; });
  if (ls.allAtk) mods.allAtk *= ls.allAtk;
  if (ls.hp) mods.hp *= ls.hp;
  if (ls.rcv) mods.rcv *= ls.rcv;
  if (ls.time) mods.timeMs += ls.time * 1000;
  // 軽減率は乗算で重ねる(80%減+50%減 = 90%減 にはならない)
  if (ls.damageCut) mods.damageCut = 1 - (1 - mods.damageCut) * (1 - ls.damageCut);
  if (ls.matchMin) mods.matchMin = Math.min(mods.matchMin || 99, ls.matchMin);
  if (ls.comboAtk) mods.comboAtk.push(ls.comboAtk);
  return mods;
}

/**
 * 出撃パーティを組み立てる。
 * @param {object|null} support サポート枠のキャラクター({...character, isSupport, ownerName, ownerIcon, isNpc})
 */
export function buildParty(support) {
  const own = ownCharacters();
  const members = support ? [...own, support] : own.slice();
  const leader = own[0] || null;

  const mods = emptyMods();
  applyLeaderSkill(mods, leader && leader.leaderSkill);
  if (support) applyLeaderSkill(mods, support.leaderSkill);

  const baseHP = BASE_PARTY_HP + members.reduce((s, m) => s + m.hp, 0);
  return {
    members,
    own,
    leader,
    support: support || null,
    leaders: [leader, support || null].filter(Boolean),
    mods,
    maxHP: Math.round(baseHP * mods.hp),
    matchMin: mods.matchMin || MATCH_MIN_DEFAULT,
    /** リーダースキル込みの1ターンの操作時間(ms) */
    baseDragTime: Math.min(MAX_DRAG_TIME, BASE_DRAG_TIME + mods.timeMs),
    skills: members.map(m => m.skill || null)
  };
}

/** コンボ数に応じたリーダースキル倍率 */
export function comboMultiplier(mods, combo) {
  return mods.comboAtk.reduce((mult, c) => (combo >= c.combo ? mult * c.mult : mult), 1);
}

/** そのキャラの攻撃に掛かるリーダースキル倍率 */
export function auraMultiplier(mods, auraKey) {
  return mods.allAtk * (mods.auraAtk[auraKey] || 1);
}
