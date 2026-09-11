/* ===================== フレンド画面 ===================== */
import { $, toast } from '../core/ui.js';
import { state } from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  cloudEnabled, addFriendByCode, removeFriend, greetFriend, greetAllFriends, refreshFriendsList
} from '../core/friends.js';
import { MAX_FRIENDS, FRIEND_GREET_REWARD } from '../data/gamedata.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    box.innerHTML = '<div class="mstats">まだフレンドがいません。フレンドコードを交換して登録しましょう。</div>';
    return;
  }
  state.profile.friends.forEach(f => {
    const greeted = f.lastGreetDate === today;
    const row = document.createElement('div');
    row.className = 'friend-row';
    row.innerHTML = `
      <div class="elemicon" style="background:rgba(255,255,255,0.08);">${f.icon || '🙂'}</div>
      <div class="minfo">
        <div class="mname">${f.name || 'プレイヤー'}</div>
        <div class="mstats">${f.code || ''}</div>
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
