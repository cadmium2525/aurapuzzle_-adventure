/* ===================== プレゼントボックス =====================
 * ホームの右上のプレゼント箱から開く受け取り画面。
 * ログインボーナス・フレンド由来のフレポ・運営からのプレゼントが
 * すべてここに集まる(中身の管理そのものは core/gifts.js)。
 * ============================================================ */
import { $, toast } from '../core/ui.js';
import { updateStatusBar } from '../core/nav.js';
import {
  giftList, giftCount, claimGift, claimAllGifts, giftRewardText, loginStreak
} from '../core/gifts.js';

/** 箱のバッジ(未受け取り件数)を更新する */
export function updatePresentBadge() {
  const badge = $('homePresentBadge');
  if (!badge) return;
  const n = giftCount();
  badge.textContent = n > 99 ? '99+' : n;
  badge.hidden = n === 0;
  const btn = $('homePresentBtn');
  if (btn) btn.classList.toggle('has-gift', n > 0);
}

function renderList() {
  const list = giftList();
  const streak = loginStreak();
  $('presentHead').innerHTML = streak
    ? `連続ログイン <b>${streak}日</b> — 続けるほどログインボーナスが増えます。`
    : '受け取った内容はすぐに所持数へ反映されます。';
  $('presentClaimAllBtn').disabled = !list.length;

  if (!list.length) {
    $('presentList').innerHTML = '<div class="empty">プレゼントはありません。</div>';
    return;
  }
  // 新しいものを上に出す
  $('presentList').innerHTML = list.slice().reverse().map(g => `
    <div class="gift-row">
      <div class="gift-main">
        <div class="gift-title">${g.title}</div>
        ${g.note ? `<div class="gift-note">${g.note}</div>` : ''}
        <div class="gift-reward">${giftRewardText(g)}</div>
      </div>
      <button class="btn tiny" data-gift="${g.id}">受け取る</button>
    </div>`).join('');
}

export function openPresentBox() {
  renderList();
  $('presentModal').classList.add('show');
}
function close() { $('presentModal').classList.remove('show'); }

export function initPresent() {
  $('homePresentBtn').addEventListener('click', openPresentBox);
  $('presentCloseBtn').addEventListener('click', close);
  $('presentModal').addEventListener('click', e => { if (e.target === $('presentModal')) close(); });

  $('presentList').addEventListener('click', e => {
    const btn = e.target.closest('[data-gift]');
    if (!btn) return;
    const g = claimGift(btn.dataset.gift);
    if (!g) return;
    toast(`${giftRewardText(g)} を受け取りました`);
    updateStatusBar();
    updatePresentBadge();
    renderList();
  });

  $('presentClaimAllBtn').addEventListener('click', () => {
    const total = claimAllGifts();
    if (!total) return;
    toast(`${total.count}件受け取りました ${giftRewardText(total)}`);
    updateStatusBar();
    updatePresentBadge();
    renderList();
  });
}
