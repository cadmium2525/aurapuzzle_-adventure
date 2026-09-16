/* =========================================================
 * resume.js — 中断したダンジョンの保存と再開
 *
 * タスクキルやリロードでゲームが落ちても、手番の切れ目まで戻って
 * 続きから遊べるようにする。保存はセーブデータ本体とは別キーにして、
 * クラウド同期の対象外(端末内だけの一時データ)にしている。
 * =======================================================*/
import { Store } from '../core/storage.js';

const KEY = 'acb_run';
const VERSION = 1;

/** 中断データを書き込む。保存に失敗してもバトルは止めない。 */
export function saveRunSnapshot(snapshot) {
  try { Store.set(KEY, { v: VERSION, savedAt: Date.now(), ...snapshot }); }
  catch (e) { /* 容量不足などは黙って諦める */ }
}

/** 中断データを読む(無い/形式が古い場合は null) */
export function loadRunSnapshot() {
  const snap = Store.get(KEY, null);
  if (!snap || snap.v !== VERSION) return null;
  if (!snap.stage || !Array.isArray(snap.enemies) || !snap.enemies.length) return null;
  return snap;
}

export function clearRunSnapshot() { Store.set(KEY, null); }
export function hasRunSnapshot() { return !!loadRunSnapshot(); }
