/* =========================================================
 * raids.js — 降臨ダンジョン
 *
 * モンスターの中身(基礎ステータス・行動パターン)は enemy-master.js が持ち、
 * ここは「どのフロアに、どのモンスターを、何倍で置くか」だけを書く。
 * 管理者ツール(admin/)で足したぶんは custom.js から合流する。
 * =======================================================*/
import { spawnEnemy } from './enemy-master.js';
import { CUSTOM_RAIDS } from './custom.js';

/** フロア1つ。ids は 'worm' か {id,form,mult} で書ける */
const floor = (ids, extra) => Object.assign(
  { enemies: ids.map(spawnEnemy).filter(Boolean) }, extra || {}
);

/** ボスのフロア。変身前(form 0)と変身後(form 1)をそれぞれ1フロアに置く */
const bossFloor = form => {
  const enemy = spawnEnemy({ id: 'kyuko', form });
  const shape = { enemies: [enemy] };
  const master = enemy && enemy.id;
  if (!master) return shape;
  // 演出(警告カットイン・変身)と台詞はマスター側に書いてある
  const meta = form === 0
    ? { intro: 'warning', dialogue: 'こんな奥まで、わたくしを追いかけてきたの？ ふふ……いい子ね。少しだけ、遊んであげる。' }
    : { intro: 'evolution', dialogue: '人の姿は、もうおしまい。九つの尾、九つのまやかし――さあ、本当のわたくしを見つけてごらんなさい。' };
  return { ...shape, ...meta };
};

export const KYUKO_RAID = {
  id: 2001, raid: true, name: '九狐降臨', bgm: 'kyuko',
  stamina: 30, coinReward: 9000, orbReward: 0, expReward: 180, charExpReward: 600,
  auras: [0, 1, 2, 3, 4], dropAura: 4, dropType: 'raid', shardRate: .35, crystalBase: 8,
  characterDrop: { id: 'dk_kyuko', rate: .5 },
  floors: [
    floor(['monolith', 'monolith', 'monolith']),
    floor(['worm', 'worm']),
    floor(['monolith', 'gia', 'gorem']),
    floor(['raiga', 'raiga']),
    floor(['kongou']),
    floor(['raiga', 'raiga']),
    floor(['gorem', 'worm']),
    floor(['gia', 'monolith', 'gia']),
    bossFloor(0),
    bossFloor(1)
  ]
};

/**
 * 管理者ツールが書いた降臨を、遊べる形に組み立てる。
 * フロアは { enemies: [{id, form, mult}], intro, dialogue } で書かれている。
 */
function buildCustomRaid(raw) {
  if (!raw || !raw.id || !Array.isArray(raw.floors)) return null;
  const floors = raw.floors.map(f => Object.assign(
    { enemies: (f.enemies || []).map(spawnEnemy).filter(Boolean) },
    f.intro ? { intro: f.intro } : {},
    f.dialogue ? { dialogue: f.dialogue } : {}
  )).filter(f => f.enemies.length);
  if (!floors.length) return null;
  return {
    stamina: 30, coinReward: 9000, orbReward: 0, expReward: 180, charExpReward: 600,
    auras: [0, 1, 2, 3, 4], dropAura: 4, shardRate: .35, crystalBase: 8,
    ...raw,
    raid: true, dropType: 'raid', floors
  };
}

export const RAID_STAGES = [KYUKO_RAID].concat(
  (CUSTOM_RAIDS || []).map(buildCustomRaid).filter(Boolean)
);

/** Own raid members contribute percentage points, supports do not. */
export function raidDropRate(stage, own) {
  return Math.min(1, (stage.characterDrop?.rate || 0) + own.reduce((sum, m) => sum + (m.awakenMods?.dropRate || 0), 0));
}
export function rollRaidCharacter(stage, own, random = Math.random) {
  return stage.raid && random() < raidDropRate(stage, own) ? stage.characterDrop.id : null;
}
