/* =========================================================
 * custom-source.js — src/js/data/custom.js の中身を組み立てる
 *
 * ここが吐いた文字列がそのままリポジトリのソースになる。
 * 壊れた JS を push するとゲームが起動しなくなるので、
 * **処理は書かず JSON リテラルだけを埋める**方針を守る。
 * DOM に触らないので tests/ から直接読める(そのためにファイルを分けている)。
 * =======================================================*/

/** ツールの作業用メモ。リポジトリには出さない */
const INTERNAL_KEYS = ['_artName', '_new', '_form', '_source', '_editing'];

/** 1件から内部用のキーを落とす */
function strip(item) {
  const copy = JSON.parse(JSON.stringify(item));
  INTERNAL_KEYS.forEach(k => { delete copy[k]; });
  return copy;
}

/**
 * 版を1つ上げる。数字として読めないときは null を返す。
 * 空文字を 0 と見なすと、読み取りに失敗しただけで版が 1 に巻き戻り、
 * ゲームが版ずれループに入るので、digits だけを受け付ける。
 */
export function nextVersion(current) {
  if (!/^\d+$/.test(String(current == null ? '' : current).trim())) return null;
  return String(Number(current) + 1);
}

/** 版が書いてある3か所と、その読み方・差し替え方 */
export const VERSION_FILES = [
  {
    path: 'index.html',
    read: t => (t.match(/<meta name="app-version" content="(\d+)">/) || [])[1] || null,
    write: (t, v) => t.replace(/<meta name="app-version" content="\d+">/,
      `<meta name="app-version" content="${v}">`)
  },
  {
    path: 'src/js/core/version.js',
    read: t => (t.match(/export const APP_VERSION = '(\d+)';/) || [])[1] || null,
    write: (t, v) => t.replace(/export const APP_VERSION = '\d+';/,
      `export const APP_VERSION = '${v}';`)
  },
  {
    path: 'sw.js',
    read: t => (t.match(/const CACHE_NAME = 'aura-connect-v(\d+)';/) || [])[1] || null,
    write: (t, v) => t.replace(/const CACHE_NAME = 'aura-connect-v\d+';/,
      `const CACHE_NAME = 'aura-connect-v${v}';`)
  }
];

/**
 * custom.js の中身を作る。
 * @param {{enemies:Array, raids:Array, characters:Array}} draft
 */
export function buildCustomJs(draft) {
  const d = draft || {};
  const json = list => JSON.stringify((list || []).map(strip), null, 2);
  return `/* =========================================================
 * custom.js — 管理者ツール(admin/)が書き出すデータ
 *
 * **手で編集しない。** admin/ のリリース画面が丸ごと置き換える。
 * 中身は JSON リテラルだけで、処理は一切書かない。
 *
 * ここに足したものは、それぞれ次の場所で本体と合流する:
 *   enemies      → data/enemies.js  と data/enemy-master.js
 *   raids        → data/raids.js    の RAID_STAGES
 *   characters   → data/characters.js の CHARACTERS(=ガチャの母集団)
 *
 * 空でも読み込まれるので、この3つのキーは必ず配列で置いておくこと。
 * =======================================================*/

/**
 * モンスターのマスターデータ。
 * 1体ぶんの形は data/enemy-master.js の説明を見ること。
 */
export const CUSTOM_ENEMIES = ${json(d.enemies)};

/**
 * 降臨ダンジョン。フロアは {id, mult} でマスターを参照する。
 */
export const CUSTOM_RAIDS = ${json(d.raids)};

/**
 * ガチャに足すキャラクター。
 * 1体ぶんの形は data/characters.js の mk() の引数を見ること。
 */
export const CUSTOM_CHARACTERS = ${json(d.characters)};

/**
 * 足すスキル。既存のスキルを分解したパーツの組み合わせ。
 * 効果のキーは data/skills.js の冒頭にある一覧がすべて。
 * 同じIDがあれば既存を上書きする(倍率の調整に使える)。
 */
export const CUSTOM_SKILLS = ${json(d.skills)};

/** 足すリーダースキル */
export const CUSTOM_LEADER_SKILLS = ${json(d.leaderSkills)};

/**
 * 1つしか無い設定。空なら既定値が使われる。
 *   pickupId     ガチャのピックアップにするキャラID
 *   pickupRate   ★4帯のうちピックアップが占める割合(0〜1)
 *   gachaBanner  ホームに出すガチャのバナー画像
 */
export const CUSTOM_SETTINGS = ${JSON.stringify(d.settings || {}, null, 2)};
`;
}
