/* =========================================================
 * skill-parts.js — スキルを組み立てるパーツ表
 *
 * 既存のスキルを分解すると、実は下の部品の組み合わせでできている。
 * ここに並べたものだけが**エンジンが実際に解釈できる**効果で、
 * それ以外のキーを書いても何も起きない(見た目だけのスキルになる)。
 * 新しい種類の効果そのものを足すには、battle/ 側の実装が要る。
 *
 * 各パーツ:
 *   key    … スキルに入る項目名
 *   label  … 画面に出す名前
 *   fields … 調整できる数値。min/max は壊れた値を弾くための範囲
 *   make   … 画面の入力からスキルの値を組み立てる
 *   read   … 既存のスキルから画面の入力へ戻す
 * =======================================================*/

const AURA_KEYS = ['c0', 'c1', 'c2', 'c3', 'c4'];
export const AURA_LABEL = { c0: '火', c1: '水', c2: '木', c3: '癒', c4: '闇' };

/* ===================== リーダースキル ===================== */

export const LEADER_PARTS = [
  {
    key: 'auraAtk', label: 'オーラ別の攻撃倍率',
    hint: '選んだオーラのキャラの攻撃力が上がる',
    fields: [
      { key: 'aura', label: 'オーラ', type: 'aura', def: 'c0' },
      { key: 'mult', label: '倍率', min: 1, max: 5, step: 0.05, def: 1.5 }
    ],
    make: v => ({ [v.aura]: v.mult }),
    read: value => {
      const aura = Object.keys(value || {})[0] || 'c0';
      return { aura, mult: (value || {})[aura] || 1.5 };
    }
  },
  {
    key: 'allAtk', label: '全オーラの攻撃倍率',
    hint: 'オーラを問わず全員の攻撃力が上がる',
    fields: [{ key: 'mult', label: '倍率', min: 1, max: 4, step: 0.05, def: 1.3 }],
    make: v => v.mult,
    read: value => ({ mult: value })
  },
  {
    key: 'comboAtk', label: 'コンボ数での攻撃倍率',
    hint: '規定コンボ以上で全体の攻撃力が上がる',
    fields: [
      { key: 'combo', label: '必要コンボ', min: 2, max: 12, step: 1, def: 4 },
      { key: 'mult', label: '倍率', min: 1, max: 4, step: 0.05, def: 1.5 }
    ],
    make: v => ({ combo: Math.round(v.combo), mult: v.mult }),
    read: value => ({ combo: (value || {}).combo || 4, mult: (value || {}).mult || 1.5 })
  },
  {
    key: 'hp', label: '最大HP倍率',
    fields: [{ key: 'mult', label: '倍率', min: 1, max: 3, step: 0.05, def: 1.2 }],
    make: v => v.mult, read: value => ({ mult: value })
  },
  {
    key: 'rcv', label: '回復力倍率',
    fields: [{ key: 'mult', label: '倍率', min: 1, max: 3, step: 0.05, def: 1.3 }],
    make: v => v.mult, read: value => ({ mult: value })
  },
  {
    key: 'time', label: 'オーラ操作時間の延長',
    hint: '秒。時間を作る効果は強いので入れすぎに注意',
    fields: [{ key: 'seconds', label: '秒', min: 0.5, max: 6, step: 0.5, def: 1.5 }],
    make: v => v.seconds, read: value => ({ seconds: value })
  },
  {
    key: 'damageCut', label: '被ダメージ軽減',
    hint: '0〜0.8。0.2 なら20%減',
    fields: [{ key: 'rate', label: '軽減率', min: 0.05, max: 0.8, step: 0.05, def: 0.2 }],
    make: v => v.rate, read: value => ({ rate: value })
  },
  {
    key: 'matchMin', label: '消すのに必要な連結数',
    hint: '既定は4。3にすると格段に消しやすくなる',
    fields: [{ key: 'count', label: '連結数', min: 3, max: 6, step: 1, def: 3 }],
    make: v => Math.round(v.count), read: value => ({ count: value })
  }
];

/* ===================== アクティブスキル ===================== */

export const ACTIVE_PARTS = [
  {
    key: 'timeThisTurn', label: 'このターンの操作時間+',
    fields: [{ key: 'seconds', label: '秒', min: 0.5, max: 12, step: 0.5, def: 4 }],
    make: v => v.seconds, read: value => ({ seconds: value })
  },
  {
    key: 'healPct', label: 'HP回復',
    hint: '最大HPに対する割合。1 で全回復',
    fields: [{ key: 'pct', label: '割合', min: 0.05, max: 1, step: 0.05, def: 0.3 }],
    make: v => v.pct, read: value => ({ pct: value })
  },
  {
    key: 'fixedDamage', label: '固定ダメージ',
    hint: '使ったキャラの攻撃力×この倍率',
    fields: [{ key: 'mult', label: '倍率', min: 1, max: 50, step: 1, def: 10 }],
    make: v => Math.round(v.mult), read: value => ({ mult: value })
  },
  {
    // 1つのスキルに何組でも置ける(カイの「火と木→水」がこの形)
    key: 'convert', label: 'オーラ変換', multi: true,
    hint: '盤面のあるオーラを別のオーラに変える。組を足せば複数色を変えられる',
    fields: [
      { key: 'from', label: '変換元', type: 'aura', def: 'c0' },
      { key: 'to', label: '変換先', type: 'aura', def: 'c1' }
    ],
    make: v => ({ from: v.from, to: v.to }),
    read: value => {
      const one = [].concat(value)[0] || {};
      return { from: one.from || 'c0', to: one.to || 'c1' };
    }
  },
  {
    key: 'spawn', label: 'オーラ生成',
    hint: 'ランダムな場所を指定のオーラに変える',
    fields: [
      { key: 'to', label: 'オーラ', type: 'aura', def: 'c0' },
      { key: 'count', label: '個数', min: 1, max: 20, step: 1, def: 8 }
    ],
    make: v => ({ to: v.to, count: Math.round(v.count) }),
    read: value => ({ to: (value || {}).to || 'c0', count: (value || {}).count || 8 })
  },
  {
    key: 'shuffle', label: '盤面シャッフル',
    hint: '数値なし。入れるだけで効く',
    fields: [],
    make: () => true, read: () => ({})
  },
  {
    key: 'atkBuff', label: '攻撃力アップ',
    fields: [
      { key: 'mult', label: '倍率', min: 1, max: 4, step: 0.05, def: 1.5 },
      { key: 'turns', label: 'ターン', min: 1, max: 10, step: 1, def: 2 }
    ],
    make: v => ({ mult: v.mult, turns: Math.round(v.turns) }),
    read: value => ({ mult: (value || {}).mult || 1.5, turns: (value || {}).turns || 2 })
  },
  {
    key: 'guard', label: '被ダメージ軽減',
    hint: '1 にすると完全無敵',
    fields: [
      { key: 'rate', label: '軽減率', min: 0.1, max: 1, step: 0.05, def: 0.5 },
      { key: 'turns', label: 'ターン', min: 1, max: 6, step: 1, def: 2 }
    ],
    make: v => ({ rate: v.rate, turns: Math.round(v.turns) }),
    read: value => ({ rate: (value || {}).rate || 0.5, turns: (value || {}).turns || 2 })
  },
  {
    key: 'delay', label: '敵の攻撃を遅らせる',
    fields: [{ key: 'turns', label: 'ターン', min: 1, max: 5, step: 1, def: 2 }],
    make: v => Math.round(v.turns), read: value => ({ turns: value })
  }
];

export const LEADER_BY_KEY = Object.fromEntries(LEADER_PARTS.map(p => [p.key, p]));
export const ACTIVE_BY_KEY = Object.fromEntries(ACTIVE_PARTS.map(p => [p.key, p]));

export function partsFor(kind) {
  return kind === 'leader' ? LEADER_PARTS : ACTIVE_PARTS;
}

/**
 * 既存のスキルを「使っているパーツ + 各数値」に分解する。
 * これが「既存を分解してパーツにする」の実体。
 */
export function decompose(skill, kind) {
  const out = [];
  partsFor(kind).forEach(part => {
    const value = skill ? skill[part.key] : null;
    if (value == null || value === false) return;
    // 複数持てるパーツは1組ずつ別のパーツとして並べる
    // (まとめて1つにすると、2組目以降が分解のたびに消えてしまう)
    const items = part.multi ? [].concat(value) : [value];
    items.forEach(v => out.push({ key: part.key, values: part.read(v) }));
  });
  return out;
}

/** パーツの並びからスキル本体(効果のキーだけ)を組み立てる */
export function compose(picked, kind) {
  const byKey = kind === 'leader' ? LEADER_BY_KEY : ACTIVE_BY_KEY;
  const out = {};
  (picked || []).forEach(p => {
    const part = byKey[p.key];
    if (!part) return;
    const made = part.make(p.values || {});
    if (!part.multi || out[p.key] == null) { out[p.key] = made; return; }
    // 2組目からは配列にまとめる(エンジンは単体でも配列でも読める)
    out[p.key] = [].concat(out[p.key], made);
  });
  return out;
}

/** そのパーツの既定値 */
export function defaultsOf(key, kind) {
  const byKey = kind === 'leader' ? LEADER_BY_KEY : ACTIVE_BY_KEY;
  const part = byKey[key];
  const values = {};
  (part ? part.fields : []).forEach(f => { values[f.key] = f.def; });
  return { key, values };
}

export { AURA_KEYS };
