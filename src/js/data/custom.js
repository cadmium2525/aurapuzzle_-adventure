/* =========================================================
 * custom.js — 管理者ツール(admin/)が書き出すデータ
 *
 * **手で編集しない。** admin/ のリリース画面が丸ごと置き換える。
 * 中身は JSON リテラルだけで、処理は一切書かない
 * (ツールが JSON.stringify した結果をそのまま埋めるため)。
 *
 * ここに足したものは、それぞれ次の場所で本体と合流する:
 *   enemies      → data/enemies.js  と data/enemy-master.js
 *   raids        → data/raids.js    の RAID_STAGES
 *   characters   → data/characters.js の CHARACTERS(=ガチャの母集団)
 *   skills       → data/skills.js の ACTIVE_SKILLS
 *   leaderSkills → data/skills.js の LEADER_SKILLS
 *   settings     → ガチャのピックアップとバナー
 *
 * 空でも読み込まれるので、この3つのキーは必ず配列で置いておくこと。
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
 * 足すスキル。{ id, name, desc, cooldown, ...効果 } の形。
 * 効果のキーは data/skills.js の冒頭にある一覧がすべて。
 * 同じIDがあれば既存を上書きする(倍率の調整に使える)。
 */
export const CUSTOM_SKILLS = [];

/** 足すリーダースキル。{ id, name, desc, ...効果 } の形 */
export const CUSTOM_LEADER_SKILLS = [];

/**
 * 1つしか無い設定。空なら既定値が使われる。
 *   pickupId     ガチャのピックアップにするキャラID
 *   pickupRate   ★4帯のうちピックアップが占める割合(0〜1)
 *   gachaBanner  ホームに出すガチャのバナー画像
 */
export const CUSTOM_SETTINGS = {};
