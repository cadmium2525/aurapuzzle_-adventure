/* ===================== マイページ画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state, saveState, resetState, maxStamina, DEFAULT_ICONS } from '../core/state.js';
import { updateProfile, updateRentalMonster, cloudEnabled } from '../core/friends.js';
import { expToNextRank, monsterById } from '../data/gamedata.js';
import { monRowHTML } from './parts.js';

let editingIcon = state.profile.icon;

export function renderMypage() {
  $('bgmRange').value = state.settings.bgm;
  $('seRange').value = state.settings.se;
  $('playerIdText').textContent = state.settings.playerId;
  $('mypageRank').textContent = `Rank ${state.rank}(EXP ${state.exp}/${expToNextRank(state.rank)})`;
  $('mypageStamina').textContent = `${state.stamina} / ${maxStamina()}`;
  $('profileNameInput').value = state.profile.name;
  editingIcon = state.profile.icon;
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
    b.addEventListener('click', () => { editingIcon = ic; renderIconGrid(); });
    grid.appendChild(b);
  });
}

/** フレンドに貸し出すレンタルモンスターの選択リスト */
function renderRentalList() {
  const box = $('rentalList');
  box.innerHTML = '';
  const owned = Object.keys(state.monsters)
    .filter(id => state.monsters[id] > 0)
    .sort((a, b) => b.localeCompare(a));
  if (!owned.length) {
    box.innerHTML = '<div class="mstats">まだモンスターを持っていません。</div>';
    return;
  }
  owned.map(monsterById).filter(Boolean)
    .sort((a, b) => b.rarity - a.rarity)
    .forEach(m => {
      const isRental = state.profile.rentalMonsterId === m.id;
      const row = document.createElement('div');
      row.className = 'mon-row';
      row.innerHTML = monRowHTML(m, state.monsters[m.id])
        + `<button class="btn ${isRental ? '' : 'secondary'} selbtn">${isRental ? '貸し出し中' : '貸し出す'}</button>`;
      row.querySelector('button').addEventListener('click', async () => {
        const next = isRental ? null : m.id;
        await updateRentalMonster(next);
        toast(next ? `${m.name}をフレンドに貸し出します` : '貸し出しを解除しました');
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
