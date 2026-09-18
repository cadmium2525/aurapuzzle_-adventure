/* =========================================================
 * banners.js — ホームに出す宣伝バナー
 *
 * 数秒ごとに切り替える。並ぶのは:
 *   ・降臨ダンジョン … **いちばん新しいものだけ**。
 *     新しい降臨を足すと、それまで出ていたバナーと入れ替わる。
 *   ・ガチャ … ピックアップ中のキャラのバナー。
 *
 * 画像が無いものは並べない(枠だけ出ても仕方がないため)。
 * =======================================================*/
import { RAID_STAGES } from './raids.js';
import { PICKUP_CHARACTER } from './gamedata.js';
import { CUSTOM_SETTINGS } from './custom.js';

/** 切り替えの間隔(ms) */
export const BANNER_INTERVAL = 5200;

/**
 * いま出すバナーの一覧。
 * @returns {Array<{key:string, image:string, alt:string, screen:string, params:object}>}
 */
export function homeBanners() {
  const list = [];

  // 降臨は最後に足したものを「いま開催中」と見なす
  const raid = RAID_STAGES[RAID_STAGES.length - 1];
  if (raid && raid.banner) {
    list.push({
      key: `raid-${raid.id}`,
      image: raid.banner,
      alt: `${raid.name} 開催中`,
      screen: 'dungeon',
      params: { mode: 'raid' }
    });
  }

  const gachaBanner = CUSTOM_SETTINGS.gachaBanner;
  if (gachaBanner && PICKUP_CHARACTER) {
    list.push({
      key: `gacha-${PICKUP_CHARACTER.id}`,
      image: gachaBanner,
      alt: `${PICKUP_CHARACTER.name} ピックアップ召喚`,
      screen: 'gacha',
      params: {}
    });
  }

  return list;
}
