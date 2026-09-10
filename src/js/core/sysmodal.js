/* =========================================================
 * sysmodal.js — トップバーの⚙から開くシステムモーダル
 * 音量調整とバトル中のリタイアをまとめる
 * =======================================================*/
import { $ } from './ui.js';
import { state, saveState } from './state.js';
import { currentScreen } from './nav.js';

let retreatHandler = null;
/** バトル側からリタイア処理を登録する */
export function setRetreatHandler(fn) { retreatHandler = fn; }

export function openSysModal() {
  $('sysBgm').value = state.settings.bgm;
  $('sysSe').value = state.settings.se;
  // リタイアはバトル中のみ表示
  $('sysRetreatBox').style.display = currentScreen === 'battle' ? 'block' : 'none';
  $('sysModal').classList.add('show');
}
export function closeSysModal() { $('sysModal').classList.remove('show'); }

export function initSysModal() {
  $('sysBtn').addEventListener('click', openSysModal);
  $('sysCloseBtn').addEventListener('click', closeSysModal);
  $('sysModal').addEventListener('click', e => { if (e.target === $('sysModal')) closeSysModal(); });
  $('sysBgm').addEventListener('input', e => { state.settings.bgm = Number(e.target.value); saveState(); });
  $('sysSe').addEventListener('input', e => { state.settings.se = Number(e.target.value); saveState(); });
  $('sysRetreatBtn').addEventListener('click', () => {
    if (!confirm('ダンジョンからリタイアします。報酬は受け取れません。よろしいですか?')) return;
    closeSysModal();
    if (retreatHandler) retreatHandler();
  });
}
