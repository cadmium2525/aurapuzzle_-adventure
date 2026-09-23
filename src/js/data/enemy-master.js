/* =========================================================
 * enemy-master.js — モンスターのマスターデータ
 *
 * 役割の分け方:
 *   マスター(ここ) … 「どんなモンスターか」。基礎ステータスと行動パターン。
 *   ステージ側      … 「どこに、何倍で出すか」。倍率だけを持つ。
 *
 * こうしておくと、同じモンスターを難易度違いで使い回せるし、
 * 管理者ツール(admin/)から1か所いじるだけで全部に効く。
 *
 * ボスの変身は forms で持つ。forms[0] が変身前、forms[1] 以降が変身後。
 * 変身のないモンスターは forms を持たない(自身が唯一の姿)。
 *
 * --- 1体ぶんの形 ---
 * {
 *   id, name, sprite, emoji,
 *   hp, atk,                 // 倍率1.0のときの値
 *   interval,                // 何ターンごとに攻撃するか
 *   enemySkills,             // 特殊行動(battle/enemy-skills.js が解釈する)
 *   forms: [ { name, sprite, emoji, hp, atk, interval, enemySkills, intro, dialogue } ]
 * }
 * =======================================================*/
import { enemyById } from './enemies.js';
import { CUSTOM_ENEMIES } from './custom.js';

/** コンボガード。turns を省くとフロアの間ずっと続く */
const guard = turns => ({ type: 'comboGuard', chains: 5, ...(turns ? { turns } : {}) });

/* --- 既存モンスターの基礎値。
       降臨で使っていた数値をそのまま基準(倍率1.0)に据えている。 --- */
const BUILTIN = {
  monolith: { hp: 4200, atk: 90, interval: 2,
    enemySkills: { preemptive: { effects: [guard(5)] } } },
  worm: { hp: 4800, atk: 110, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraAbsorb', aura: 2, turns: 5 }] } } },
  gia: { hp: 4600, atk: 100, interval: 2,
    enemySkills: {
      preemptive: { effects: [{ type: 'timeReduce', seconds: 2, turns: 1 }] },
      random: true,
      actions: [{ attack: true }, { effects: [{ type: 'timeReduce', seconds: 2, turns: 1 }] }]
    } },
  gorem: { hp: 6200, atk: 105, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'resolve', threshold: 50 }] }, buildUpBelow: 50 } },
  raiga: { hp: 4000, atk: 85, interval: 1,
    enemySkills: { preemptive: { effects: [{ type: 'bind', count: 1, turns: 2 }] } } },
  kongou: { hp: 14500, atk: 160, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'timeFixed', seconds: 5, turns: 3 }, guard(3)] } } },
  gost: { hp: 3800, atk: 80, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'skillDelay', count: 1, turns: 1 }] } } },
  glyphowl: { emoji: '🦉', hp: 5200, atk: 95, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'shapeGuard', shape: 'L', turns: 2 }] } } },
  umbrastag: { emoji: '🦌', hp: 4700, atk: 100, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraBind', aura: 1, turns: 2 }] } } },
  chronosnail: { emoji: '🐌', hp: 5500, atk: 90, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'timeFixed', seconds: 6, turns: 2 }] } } },
  mirrorjelly: { emoji: '🪼', hp: 4800, atk: 85, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraAbsorb', aura: 1, turns: 3 }] } } },
  arcanacauldron: { emoji: '🫕', hp: 5700, atk: 105, interval: 2,
    enemySkills: { preemptive: { effects: [
      { type: 'auraAbsorb', aura: 1, turns: 3 },
      { type: 'auraAbsorb', aura: 4, turns: 3 }
    ] } } },
  arcanacauldron_fire: { emoji: '🫕', hp: 5400, atk: 105, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraAbsorb', aura: 0, turns: 3 }] } } },
  arcanacauldron_wood: { emoji: '🫕', hp: 5400, atk: 105, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraAbsorb', aura: 2, turns: 3 }] } } },
  arcanacauldron_heal: { emoji: '🫕', hp: 5400, atk: 105, interval: 2,
    enemySkills: { preemptive: { effects: [{ type: 'auraBind', aura: 3, turns: 3 }] } } },

  /* --- 九狐。変身するボスなので forms を持つ --- */
  kyuko: {
    boss: true,
    name: 'キュウコ', emoji: '🦊', sprite: 'assets/chars/kyuko_1.webp',
    forms: [
      {
        name: 'キュウコ', sprite: 'assets/chars/kyuko_1.webp', emoji: '🦊',
        hp: 18000, atk: 120, interval: 1, intro: 'warning',
        dialogue: 'こんな奥まで、わたくしを追いかけてきたの？ ふふ……いい子ね。少しだけ、遊んであげる。',
        enemySkills: {
          preemptive: { effects: [
            { type: 'skillDelay', count: 4, turns: 1 },
            { type: 'timeReduce', seconds: 3, turns: 5 }
          ] },
          random: true,
          actions: [
            { attack: true, dialogue: 'ふふ、見惚れていたの？ 隙だらけよ。' },
            { attack: true, dialogue: 'こちらへおいで。……あら、そちらはわたくしの影。' },
            { attack: true, dialogue: 'もう帰るだなんて言わないで。遊びはこれからでしょう？' }
          ]
        }
      },
      {
        id: 'kyuko_evolved', name: '九尾の幻姫・キュウコ',
        sprite: 'assets/chars/kyuko_2.webp', emoji: '🦊',
        hp: 26000, atk: 145, interval: 1, intro: 'evolution',
        dialogue: '人の姿は、もうおしまい。九つの尾、九つのまやかし――さあ、本当のわたくしを見つけてごらんなさい。',
        enemySkills: {
          preemptive: { effects: [guard(), { type: 'resolve', threshold: 50 }, { type: 'summonClones' }] },
          random: true,
          actions: [
            { attack: true, effects: [{ type: 'skillDelay', count: 2, turns: 1 }],
              dialogue: 'その術、もう少し待っていてくださる？' },
            { attack: true, effects: [{ type: 'bind', count: 1, turns: 2 }],
              dialogue: '動かないで。あなたの影を、わたくしに頂戴。' },
            { attack: true, effects: [{ type: 'auraBind', aura: 2, turns: 2 }],
              dialogue: '緑の灯は、しばし夢の中へ。' },
            { attack: true, effects: [{ type: 'auraBind', aura: 1, turns: 1 }],
              dialogue: '水面に映るものが、本当のあなたかしら？' }
          ]
        }
      }
    ]
  }
};

/** マスター全体。custom.js のぶんは同じidなら上書きする(差し替えができる) */
export const ENEMY_MASTER = (() => {
  const all = {};
  Object.keys(BUILTIN).forEach(id => { all[id] = { id, ...BUILTIN[id] }; });
  (CUSTOM_ENEMIES || []).forEach(e => { if (e && e.id) all[e.id] = { ...all[e.id], ...e }; });
  return all;
})();

export const ENEMY_MASTER_IDS = Object.keys(ENEMY_MASTER);

export function enemyMasterById(id) { return ENEMY_MASTER[id] || null; }

/** 通常抽選から隔離するボスか。forms は属性導入前データの互換判定。 */
export function isBossEnemy(id) {
  const master = ENEMY_MASTER[id];
  return !!(master && (master.boss || master.forms));
}

/** そのモンスターの姿の数(変身しないなら1) */
export function formCountOf(id) {
  const m = ENEMY_MASTER[id];
  return m && m.forms ? m.forms.length : 1;
}

/**
 * マスターの1つの姿を、id/name/sprite まで埋めた形で返す。
 * @param {string} id   マスターのID
 * @param {number} form 何番目の姿か(変身しないモンスターは0だけ)
 */
export function enemyFormOf(id, form = 0) {
  const master = ENEMY_MASTER[id];
  if (!master) return null;
  // enemies.js に絵がある(通常のモンスター)ならそこから名前と画像を借りる
  const listed = enemyById(id) || {};
  const shape = master.forms ? (master.forms[form] || master.forms[0]) : master;
  return {
    id: shape.id || master.id || id,
    name: shape.name || master.name || listed.name || id,
    sprite: shape.sprite || master.sprite || listed.sprite,
    emoji: shape.emoji || master.emoji || '👹',
    hp: shape.hp, atk: shape.atk,
    interval: shape.interval == null ? 2 : shape.interval,
    enemySkills: shape.enemySkills,
    intro: shape.intro,
    dialogue: shape.dialogue,
    boss: isBossEnemy(id)
  };
}

/**
 * フロアに置く1体を組み立てる。マスターの基礎値に倍率をかける。
 * @param {{id:string, form?:number, mult?:number|{hp?:number, atk?:number}}} spec
 */
export function spawnEnemy(spec) {
  const at = typeof spec === 'string' ? { id: spec } : (spec || {});
  const shape = enemyFormOf(at.id, at.form || 0);
  if (!shape) return null;
  const m = at.mult == null ? 1 : at.mult;
  const hpMult  = typeof m === 'number' ? m : (m.hp  == null ? 1 : m.hp);
  const atkMult = typeof m === 'number' ? m : (m.atk == null ? 1 : m.atk);
  const out = {
    id: shape.id, name: shape.name, sprite: at.sprite || shape.sprite, emoji: shape.emoji,
    hp: Math.round(shape.hp * hpMult),
    atk: Math.round(shape.atk * atkMult),
    interval: at.interval == null ? shape.interval : at.interval,
    boss: shape.boss
  };
  // 行動パターンは共有すると戦闘中の書き換えが他所へ漏れるので複製する
  if (shape.enemySkills) out.enemySkills = structuredClone(shape.enemySkills);
  return out;
}
