/* ===================== マイページ画面 ===================== */
import { $, toast } from '../core/ui.js';
import {
  state, saveState, resetState, maxStamina, ownedCharacters, DEFAULT_ICONS
} from '../core/state.js';
import { updateProfile, updateRentalCharacter, cloudEnabled } from '../core/friends.js';
import { expToNextRank, characterById, AURAS, COLOR_HEX } from '../data/gamedata.js';
import { charRowHTML } from './parts.js';

let editingIcon = state.profile.icon;

export function renderMypage() {
  $('bgmRange').value = state.settings.bgm;
  $('seRange').value = state.settings.se;
  $('playerIdText').textContent = state.settings.playerId;
  $('mypageRank').textContent = `Rank ${state.rank}(EXP ${state.exp}/${expToNextRank(state.rank)})`;
  const over = state.stamina > maxStamina();
  $('mypageStamina').innerHTML = `${state.stamina} / ${maxStamina()}`
    + (over ? ' <span class="overtag">OVER</span>' : '');
  $('profileNameInput').value = state.profile.name;
  $('profileRankText').textContent = `Rank ${state.rank} ・ ${state.settings.playerId}`;
  editingIcon = state.profile.icon;
  $('profileAvatar').textContent = editingIcon;
  renderIconGrid();
  renderRentalList();
  $('cloudStatusText').textContent = cloudEnabled()
    ? 'クラウド保存: 有効(フレンドデータはFirebaseに保存されます)'
    : 'クラウド保存: 未設定(フレンド機能を使うにはFirebase設定が必要です)';
}

function renderIconGrid() {
  const grid = $('iconGrid');
  grid.innerHTML = '';
  DEFAULT_ICONS.forEach(ic => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-choice' + (ic === editingIcon ? ' active' : '');
    b.textContent = ic;
    b.addEventListener('click', () => {
      editingIcon = ic;
      $('profileAvatar').textContent = ic;
      renderIconGrid();
    });
    grid.appendChild(b);
  });
}

/** フレンドに貸し出すキャラクターの選択リスト */
function renderRentalList() {
  const box = $('rentalList');
  box.innerHTML = '';
  const owned = ownedCharacters();
  if (!owned.length) {
    box.innerHTML = '<div class="empty">まだ仲間がいません。</div>';
    return;
  }
  owned.forEach(ch => {
    const isRental = state.profile.rentalCharId === ch.id;
    const row = document.createElement('div');
    row.className = 'char-row' + (isRental ? ' in-team' : '');
    row.innerHTML = charRowHTML(ch, state.characters[ch.id])
      + `<div class="row-actions"><button class="btn ${isRental ? '' : 'secondary'} selbtn">${isRental ? '貸出中' : '貸し出す'}</button></div>`;
    row.querySelector('button').addEventListener('click', async () => {
      const next = isRental ? null : ch.id;
      await updateRentalCharacter(next);
      toast(next ? `${ch.name}をフレンドに貸し出します` : '貸し出しを解除しました');
      renderRentalList();
    });
    box.appendChild(row);
  });
}

export function initMypage() {
  $('bgmRange').addEventListener('input', e => { state.settings.bgm = Number(e.target.value); saveState(); });
  $('seRange').addEventListener('input', e => { state.settings.se = Number(e.target.value); saveState(); });

  $('copyIdBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.settings.playerId); toast('フレンドコードをコピーしました'); }
    catch (e) { toast(state.settings.playerId); }
  });

  $('saveProfileBtn').addEventListener('click', async () => {
    const name = ($('profileNameInput').value || '').trim().slice(0, 12) || 'プレイヤー';
    await updateProfile(name, editingIcon);
    toast('プロフィールを保存しました');
    renderMypage();
  });

  $('resetDataBtn').addEventListener('click', () => {
    if (!confirm('すべてのデータを初期化します。よろしいですか?')) return;
    resetState();
    location.reload();
  });
}
