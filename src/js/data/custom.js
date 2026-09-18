/* =========================================================
 * custom.js — 管理者ツール(admin/)が書き出すデータ
 *
 * **手で編集しない。** admin/ のリリース画面が丸ごと置き換える。
 * 中身は JSON リテラルだけで、処理は一切書かない。
 *
 * ここに足したものは、それぞれ次の場所で本体と合流する:
 *   enemies      → data/enemies.js  と data/enemy-master.js
 *   raids        → data/raids.js    の RAID_STAGES
 *   characters   → data/characters.js の CHARACTERS(=ガチャの母集団)
 *   gifts        → core/gifts.js のプレゼントボックス
 *
 * 空でも読み込まれるので、各キーは必ず配列で置いておくこと。
 * =======================================================*/

/**
 * モンスターのマスターデータ。
 * 1体ぶんの形は data/enemy-master.js の説明を見ること。
 */
export const CUSTOM_ENEMIES = [];

/**
 * 降臨ダンジョン。フロアは {id, mult} でマスターを参照する。
 */
export const CUSTOM_RAIDS = [];

/**
 * ガチャに足すキャラクター。
 * 1体ぶんの形は data/characters.js の mk() の引数を見ること。
 */
export const CUSTOM_CHARACTERS = [];

/**
 * 足すスキル。既存のスキルを分解したパーツの組み合わせ。
 * 効果のキーは data/skills.js の冒頭にある一覧がすべて。
 * 同じIDがあれば既存を上書きする(倍率の調整に使える)。
 */
export const CUSTOM_SKILLS = [];

/** 足すリーダースキル */
export const CUSTOM_LEADER_SKILLS = [];

/**
 * プレゼントボックスへ配るもの。key ごとに一度だけ届く。
 *   key       配布の目印。**配り直すときは新しい key にする**
 *   from / to 配布期間(YYYY-MM-DD。省略すると期間なし)
 *   coin / orb / frepo / stamina / char  中身
 */
export const CUSTOM_GIFTS = [
  {
    "key": "gift_emiri_debut",
    "title": "エミリ実装記念",
    "note": "新キャラクター「エミリ」の実装を記念して、ダイヤ45個をお贈りします。",
    "from": "2026-09-19",
    "to": "2026-10-19",
    "orb": 45
  }
];

/**
 * 1つしか無い設定。空なら既定値が使われる。
 *   pickupId     ガチャのピックアップにするキャラID
 *   pickupRate   ★4帯のうちピックアップが占める割合(0〜1)
 *   gachaBanner  ホームに出すガチャのバナー画像
 */
export const CUSTOM_SETTINGS = {};
