/* ===================== 設定画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, saveState, resetState, maxStamina } from '../core/state.js';
import { expToNextRank } from '../data/gamedata.js';

export function renderSettings() {
  $('bgmRange').value = state.settings.bgm;
  $('seRange').value = state.settings.se;
  $('playerIdText').textContent = state.settings.playerId;
  $('settingsRank').textContent = `Rank ${state.rank}(EXP ${state.exp}/${expToNextRank(state.rank)})`;
  $('settingsStamina').textContent = `${state.stamina} / ${maxStamina()}`;
}

export function initSettings() {
  $('bgmRange').addEventListener('input', e => { state.settings.bgm = Number(e.target.value); saveState(); });
  $('seRange').addEventListener('input', e => { state.settings.se = Number(e.target.value); saveState(); });
  $('copyIdBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.settings.playerId); toast('コピーしました'); }
    catch (e) { toast(state.settings.playerId); }
  });
  $('resetDataBtn').addEventListener('click', () => {
    if (!confirm('すべてのデータを初期化します。よろしいですか?')) return;
    resetState();
    location.reload();
  });
}
