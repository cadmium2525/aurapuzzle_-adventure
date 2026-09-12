/* =========================================================
 * skills.js — リーダースキル / スキルの定義
 *
 * 【リーダースキル】自陣リーダー(編成1番目)とサポート枠のキャラクターの
 *   2つだけが常時発動する。効果は battle/effects.js で合成される。
 *   - auraAtk  {auraKey:倍率}  そのオーラのキャラの攻撃倍率
 *   - allAtk   倍率            全キャラの攻撃倍率
 *   - hp       倍率            最大HP倍率
 *   - rcv      倍率            回復量倍率
 *   - time     秒              オーラ操作時間の延長
 *   - damageCut 0〜1           被ダメージ軽減率
 *   - comboAtk {combo, mult}   規定コンボ以上で全体攻撃倍率
 *   - matchMin 個数            消滅に必要な連結数を緩和する
 *
 * 【スキル】バトル中にキャラをタップして発動。cooldown ターンで再使用可能。
 *   - timeThisTurn 秒          このターンの操作時間を延長(戦術の要)
 *   - healPct      0〜1        最大HPに対する回復割合
 *   - fixedDamage  倍率        使用キャラの攻撃力×倍率のダメージ
 *   - convert  {from,to}       盤面のオーラを変換
 *   - spawn    {to,count}      ランダムなオーラを指定オーラへ変換
 *   - shuffle  true            盤面をシャッフル
 *   - atkBuff  {mult,turns}    一定ターン攻撃力アップ
 *   - guard    {rate,turns}    一定ターン被ダメージ軽減
 *   - delay    ターン          敵の攻撃ターンを遅らせる
 * =======================================================*/

export const LEADER_SKILLS = {
  /* --- 汎用 --- */
  ls_novice:  { name: '新米の気合',   desc: '全オーラの攻撃力1.15倍',                    allAtk: 1.15 },
  ls_scout:   { name: '斥候の目',     desc: 'オーラ操作時間+1.0秒',                      time: 1.0 },

  /* --- 火 --- */
  ls_ember:   { name: '灯火の構え',   desc: '火オーラの攻撃力1.3倍',                     auraAtk: { c0: 1.3 } },
  ls_blaze:   { name: '猛火の号令',   desc: '火オーラの攻撃力1.6倍',                     auraAtk: { c0: 1.6 } },
  ls_burst:   { name: '連撃の指揮',   desc: '4コンボ以上で全オーラの攻撃力1.5倍',        comboAtk: { combo: 4, mult: 1.5 } },
  ls_inferno: { name: '焔姫の祝福',   desc: '火オーラ1.8倍・最大HP1.2倍',                auraAtk: { c0: 1.8 }, hp: 1.2 },
  ls_ignis:   { name: '業火の覇者',   desc: '火オーラ2.2倍・操作時間+2.0秒',             auraAtk: { c0: 2.2 }, time: 2.0 },

  /* --- 水 --- */
  ls_ripple:  { name: '静水の呼吸',   desc: 'オーラ操作時間+1.5秒',                      time: 1.5 },
  ls_tide:    { name: '潮流の心得',   desc: '水オーラ1.4倍・操作時間+0.5秒',             auraAtk: { c1: 1.4 }, time: 0.5 },
  ls_frost:   { name: '氷結の思考',   desc: 'オーラ操作時間+3.0秒',                      time: 3.0 },
  ls_abyss:   { name: '深海の守り',   desc: '水オーラ1.7倍・被ダメージ20%減',            auraAtk: { c1: 1.7 }, damageCut: 0.2 },
  ls_aquaris: { name: '蒼海の理',     desc: '操作時間+4.0秒・水オーラ1.8倍',             time: 4.0, auraAtk: { c1: 1.8 } },

  /* --- 木 --- */
  ls_sprout:  { name: '芽吹きの導き', desc: '木オーラの攻撃力1.3倍',                     auraAtk: { c2: 1.3 } },
  ls_herb:    { name: '癒草の知恵',   desc: '回復力1.4倍',                               rcv: 1.4 },
  ls_guard:   { name: '樹護の誓い',   desc: '木オーラ1.6倍・最大HP1.15倍',               auraAtk: { c2: 1.6 }, hp: 1.15 },
  ls_wind:    { name: '風読みの極意', desc: '5コンボ以上で全オーラの攻撃力1.8倍',        comboAtk: { combo: 5, mult: 1.8 } },
  ls_yggd:    { name: '世界樹の恵み', desc: '連結3個で消えるようになる・木オーラ1.3倍',  matchMin: 3, auraAtk: { c2: 1.3 } },

  /* --- 癒 --- */
  ls_pray:    { name: '祈りの灯',     desc: '回復力1.3倍',                               rcv: 1.3 },
  ls_vow:     { name: '守護の誓約',   desc: '最大HP1.3倍',                               hp: 1.3 },
  ls_bless:   { name: '白光の加護',   desc: '回復力1.8倍・操作時間+1.0秒',               rcv: 1.8, time: 1.0 },
  ls_paladin: { name: '聖騎士の盾',   desc: '最大HP1.5倍・被ダメージ15%減',              hp: 1.5, damageCut: 0.15 },
  ls_aurora:  { name: '大聖女の福音', desc: '全オーラ1.4倍・回復2.0倍・操作時間+2.0秒',  allAtk: 1.4, rcv: 2.0, time: 2.0 }
};

export const ACTIVE_SKILLS = {
  /* --- 汎用 --- */
  sk_novice_time: { name: '気合い',       desc: 'このターンの操作時間+2.0秒',                     cooldown: 4,  timeThisTurn: 2.0 },

  /* --- 火 --- */
  sk_strike:      { name: '火炎斬り',     desc: '敵に攻撃力×12のダメージ',                        cooldown: 5,  fixedDamage: 12 },
  sk_flamewave:   { name: '紅蓮波',       desc: '木オーラを火オーラに変化',                       cooldown: 8,  convert: { from: 'c2', to: 'c0' } },
  sk_warcry:      { name: '鬨の声',       desc: '3ターンの間、攻撃力1.6倍',                       cooldown: 9,  atkBuff: { mult: 1.6, turns: 3 } },
  sk_ember_time:  { name: '熱狂',         desc: 'このターンの操作時間+3.0秒',                     cooldown: 6,  timeThisTurn: 3.0 },
  sk_ignition:    { name: '業火解放',     desc: 'ランダム8個を火オーラに変化・操作時間+2.0秒',    cooldown: 11, spawn: { to: 'c0', count: 8 }, timeThisTurn: 2.0 },

  /* --- 水 --- */
  sk_calm:        { name: '静心',         desc: 'このターンの操作時間+4.0秒',                     cooldown: 5,  timeThisTurn: 4.0 },
  sk_delay:       { name: '潮流操作',     desc: '敵の攻撃を2ターン遅らせる',                      cooldown: 9,  delay: 2 },
  sk_freeze:      { name: '絶対零度',     desc: 'このターンの操作時間+7.0秒',                     cooldown: 10, timeThisTurn: 7.0 },
  sk_aqua_conv:   { name: '潮変化',       desc: '火オーラを水オーラに変化',                       cooldown: 8,  convert: { from: 'c0', to: 'c1' } },
  sk_barrier:     { name: '深海の護り',   desc: '2ターンの間、被ダメージ50%減',                   cooldown: 10, guard: { rate: 0.5, turns: 2 } },
  sk_maelstrom:   { name: '大海流',       desc: '盤面をシャッフル・このターンの操作時間+5.0秒',   cooldown: 12, shuffle: true, timeThisTurn: 5.0 },

  /* --- 木 --- */
  sk_heal_s:      { name: '薬草調合',     desc: '最大HPの30%を回復',                              cooldown: 6,  healPct: 0.3 },
  sk_wood_conv:   { name: '森の導き',     desc: '水オーラを木オーラに変化',                       cooldown: 8,  convert: { from: 'c1', to: 'c2' } },
  sk_wind_time:   { name: '追い風',       desc: 'このターンの操作時間+4.0秒・敵の攻撃を1ターン遅延', cooldown: 9, timeThisTurn: 4.0, delay: 1 },
  sk_heal_l:      { name: '大樹の祝福',   desc: '最大HPの55%を回復',                              cooldown: 10, healPct: 0.55 },
  sk_forest:      { name: '芽吹き',       desc: 'ランダム10個を木オーラに変化',                   cooldown: 11, spawn: { to: 'c2', count: 10 } },
  sk_hunt:        { name: '狙撃',         desc: '敵に攻撃力×10のダメージ',                        cooldown: 5,  fixedDamage: 10 },

  /* --- 癒 --- */
  sk_heal_m:      { name: '治癒の祈り',   desc: '最大HPの25%を回復',                              cooldown: 5,  healPct: 0.25 },
  sk_light:       { name: '聖光',         desc: 'ランダム8個を癒オーラに変化',                    cooldown: 9,  spawn: { to: 'c3', count: 8 } },
  sk_holy_guard:  { name: '聖盾',         desc: '3ターンの間、被ダメージ70%減',                   cooldown: 12, guard: { rate: 0.7, turns: 3 } },
  sk_grace:       { name: '光明の導き',   desc: '最大HPの60%を回復・このターンの操作時間+4.0秒',  cooldown: 12, healPct: 0.6, timeThisTurn: 4.0 },
  sk_miracle:     { name: '暁の奇跡',     desc: 'HP全回復・1ターン無敵・このターンの操作時間+5.0秒', cooldown: 15, healPct: 1, guard: { rate: 1, turns: 1 }, timeThisTurn: 5.0 }
};

export function leaderSkillById(id) { return LEADER_SKILLS[id] || null; }
export function activeSkillById(id) { return ACTIVE_SKILLS[id] || null; }
