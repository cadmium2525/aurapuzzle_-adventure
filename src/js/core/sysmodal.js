/* =========================================================
 * sysmodal.js — トップバーの⚙から開くシステムモーダル
 * 音量調整とバトル中のリタイアをまとめる
 * =======================================================*/
import { $ } from './ui.js';
import { state, saveState } from './state.js';
import { currentScreen } from './nav.js';
import { setBgmVolume } from './audio.js';
import { APP_VERSION } from './version.js';

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
  $('sysBgm').addEventListener('input', e => {
    state.settings.bgm = Number(e.target.value); setBgmVolume(state.settings.bgm); saveState();
  });
  $('sysSe').addEventListener('input', e => { state.settings.se = Number(e.target.value); saveState(); });
  $('sysRetreatBtn').addEventListener('click', () => {
    if (!confirm('ダンジョンからリタイアします。報酬は受け取れません。よろしいですか?')) return;
    closeSysModal();
    if (retreatHandler) retreatHandler();
  });
  $('sysDiagBtn').addEventListener('click', () => {
    const box = $('sysDiag');
    box.hidden = false;
    box.textContent = diagnose();
  });
}

/**
 * 敵のHPバーが実際にどうなっているかを、そのまま文字にして出す。
 * 手元の環境では再現しない表示の不具合を、実機から持ち帰るための窓口。
 */
function diagnose() {
  const bar = document.querySelector('#enemyRoster .foe-health');
  const lines = [`版 ${APP_VERSION}`, `画面幅 ${innerWidth}x${innerHeight} / 倍率 ${devicePixelRatio}`];
  if (!bar) return lines.concat('HPバーの要素が見つかりません').join('\n');
  const r = bar.getBoundingClientRect();
  const cs = getComputedStyle(bar);
  const button = bar.closest('button');
  lines.push(
    `枠 ${r.width.toFixed(1)}x${r.height.toFixed(1)} (x${r.x.toFixed(0)} y${r.y.toFixed(0)})`,
    `display ${cs.display} / position ${cs.position}`,
    `背景色 ${cs.backgroundColor}`,
    `背景画像 ${String(cs.backgroundImage).slice(0, 90)}`,
    `不透明度 ${cs.opacity} / 可視 ${cs.visibility}`,
    `親 ${bar.parentElement ? bar.parentElement.className : '-'}`,
    `ボタンの中か ${button ? 'はい (' + getComputedStyle(button).webkitAppearance + ')' : 'いいえ'}`);
  return lines.join('\n');
}
