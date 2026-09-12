/* ===================== マイページ画面 ===================== */
import { $, toast } from '../core/ui.js';
import {
  state, saveState, resetState, maxStamina, ownedCharacters, DEFAULT_ICONS
} from '../core/state.js';
import { updateProfile, updateRentalCharacter, cloudEnabled } from '../core/friends.js';
import {
  accountStatus, registerAccount, loginAccount, logoutAccount
} from '../core/account.js';
import { getUid } from '../core/firebase.js';
import { expToNextRank } from '../data/gamedata.js';
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
  renderAccount();
}

/* ===================== アカウント ===================== */

const STATUS_TEXT = {
  offline:    'クラウド機能が利用できません。この端末の中だけでプレイできます。',
  connecting: '接続中です。少しお待ちください。',
  guest:      'ゲストとしてプレイ中です。IDとパスワードを登録すると、'
            + '別の端末でも同じデータで遊べるようになります。'
};

let waitingForAuth = false;

function renderAccount() {
  const st = accountStatus();
  // サインインが済むまでは状態が確定しないので、確定したら一度だけ描き直す
  if (st.state === 'connecting' && !waitingForAuth) {
    waitingForAuth = true;
    getUid().catch(() => null).then(() => { waitingForAuth = false; renderAccount(); });
  }
  const isSignedIn = st.state === 'signedIn';
  const canRegister = st.state === 'guest';

  $('accountStatusText').textContent = isSignedIn
    ? `ID「${st.id}」でログイン中です。${st.admin ? '(管理者アカウント)' : ''}`
    : STATUS_TEXT[st.state] || '';

  $('accountForm').hidden = !canRegister;
  $('accountSignedIn').hidden = !isSignedIn;
}

/** 処理結果を画面に出す(成功/失敗で色を変える) */
function accountMessage(text, ok) {
  const box = $('accountMessage');
  box.hidden = !text;
  box.textContent = text || '';
  box.classList.toggle('ng', !ok);
}

/** 二重送信を防ぎつつ非同期処理を走らせる */
async function runAccountAction(fn) {
  const btns = ['accountRegisterBtn', 'accountLoginBtn', 'accountLogoutBtn'].map($).filter(Boolean);
  btns.forEach(b => { b.disabled = true; });
  accountMessage('', true);
  try {
    const res = await fn();
    accountMessage(res.message, res.ok);
    if (res.ok && res.reload) {
      // uid が入れ替わるので、画面の作り直しではなく読み込み直しで揃える
      setTimeout(() => location.reload(), 900);
      return;
    }
    if (res.ok) {
      $('accountPwInput').value = '';
      renderAccount();
    }
  } catch (e) {
    accountMessage('処理に失敗しました', false);
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

function initAccount() {
  const id = () => $('accountIdInput').value;
  const pw = () => $('accountPwInput').value;

  $('accountRegisterBtn').addEventListener('click', () =>
    runAccountAction(() => registerAccount(id(), pw())));

  $('accountLoginBtn').addEventListener('click', () => {
    if (!confirm('この端末の進行データは、ログイン先のアカウントのデータで上書きされます。よろしいですか?')) return;
    runAccountAction(() => loginAccount(id(), pw()));
  });

  $('accountLogoutBtn').addEventListener('click', () => {
    if (!confirm('ログアウトするとこの端末のデータは消えます(アカウントのデータはクラウドに残ります)。よろしいですか?')) return;
    runAccountAction(() => logoutAccount());
  });
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

  initAccount();

  $('resetDataBtn').addEventListener('click', () => {
    if (!confirm('すべてのデータを初期化します。よろしいですか?')) return;
    resetState();
    location.reload();
  });
}
