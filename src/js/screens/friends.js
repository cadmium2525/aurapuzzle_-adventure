/* ===================== フレンド画面 ===================== */
import { $, toast, charIcon } from '../core/ui.js';
import { state } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  cloudEnabled, addFriendByCode, removeFriend, greetFriend, greetAllFriends, refreshFriendsList
} from '../core/friends.js';
import { MAX_FRIENDS, FRIEND_GREET_REWARD, resolveCharacter } from '../data/gamedata.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * フレンドのアイコン。マイページで設定した貸し出しキャラのイラストを使う。
 * 未設定・イラスト未用意のときは絵文字に落ちる。
 */
function friendAvatarHTML(f) {
  const ch = f.rentalCharId
    ? resolveCharacter(f.rentalCharId, f.rentalStar, f.rentalLv, f.rentalAwa)
    : null;
  const src = (ch && ch.art && ch.art.icon) || '';
  const emoji = (ch && ch.portrait) || f.icon || '🙂';
  return charIcon(src, emoji, 'pi');
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lastLoginText(value) {
  const ms = timestampMs(value);
  if (!ms) return '不明';
  const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export async function renderFriends() {
  $('friendCloudNotice').style.display = cloudEnabled() ? 'none' : 'block';
  $('friendCountText').textContent = `${state.profile.friends.length} / ${MAX_FRIENDS} 人`;
  renderList();
  if (cloudEnabled()) {
    await refreshFriendsList();
    renderList();
  }
}

function renderList() {
  const box = $('friendList');
  box.innerHTML = '';
  const today = todayStr();
  if (!state.profile.friends.length) {
    box.innerHTML = '<div class="empty">まだフレンドがいません。フレンドコードを交換して登録しましょう。<br>フレンドがいなくても、ダンジョンでは<b>NPCサポート</b>を選べます。</div>';
    return;
  }
  state.profile.friends.forEach(f => {
    const greeted = f.lastGreetDate === today;
    const row = document.createElement('div');
    row.className = 'friend-row';
    row.innerHTML = `
      <div class="friend-avatar">${friendAvatarHTML(f)}</div>
      <div class="cinfo">
        <div class="cname">${f.name || 'プレイヤー'}</div>
        <div class="cmeta">${f.code || ''}</div>
        <div class="friend-status"><span>ランク:${f.rank || '--'}</span><span>最終ログイン ${lastLoginText(f.lastLoginAt)}</span></div>
      </div>
      <button class="btn ${greeted ? 'secondary' : ''} greetbtn" ${greeted ? 'disabled' : ''}>${greeted ? '済み' : 'あいさつ'}</button>
      <button class="friend-del" aria-label="削除">✕</button>`;
    row.querySelector('.greetbtn').addEventListener('click', async () => {
      const res = await greetFriend(f.uid);
      toast(res.message);
      if (res.ok) { updateStatusBar(); renderList(); }
    });
    row.querySelector('.friend-del').addEventListener('click', async () => {
      if (!confirm(`${f.name || 'このフレンド'}を削除しますか?`)) return;
      await removeFriend(f.uid);
      renderList();
      $('friendCountText').textContent = `${state.profile.friends.length} / ${MAX_FRIENDS} 人`;
    });
    box.appendChild(row);
  });
}

export function initFriends() {
  $('addFriendBtn').addEventListener('click', async () => {
    const input = $('friendCodeInput');
    const res = await addFriendByCode(input.value);
    toast(res.message);
    if (res.ok) { input.value = ''; updateStatusBar(); renderFriends(); }
  });
  $('greetAllBtn').addEventListener('click', async () => {
    const n = await greetAllFriends();
    toast(n > 0 ? `${n}人にあいさつしてフレポ+${n * FRIEND_GREET_REWARD}` : '今日はもうあいさつ済みです');
    updateStatusBar();
    renderList();
  });
}
