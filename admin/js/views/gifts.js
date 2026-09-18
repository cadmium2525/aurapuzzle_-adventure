/* =========================================================
 * gifts.js — プレゼントボックスへ配るものを作る
 *
 * 配布は「配る」と「受け取る」を分けている(core/gifts.js)。ここで作るのは
 * 配る側の定義で、プレイヤーは次の起動でプレゼントボックスに受け取る。
 *
 * ■ key が配布の目印
 * 端末は受け取った key を覚えていて、同じ key は二度と配らない。
 * そのため**中身を書き換えても、受け取り済みの人には届かない**。
 * 配り直したいときは新しい key で作る(画面でもそう言っている)。
 *
 * ■ 期間
 * from / to は YYYY-MM-DD。期間前は配らずに見送る(先に配ってしまうと、
 * 期間に入っても「配布済み」の扱いで届かなくなるため)。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find } from '../draft.js';

/** 編集中のプレゼント。null なら一覧 */
let editing = null;

const REWARDS = [
  { key: 'coin', label: 'ゴールド', icon: '💰', max: 9999999 },
  { key: 'orb', label: 'ダイヤ', icon: '💎', max: 99999 },
  { key: 'frepo', label: 'フレンドポイント', icon: '🎗️', max: 999999 },
  { key: 'stamina', label: 'スタミナ', icon: '⚡', max: 9999 }
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 下書きも含めた全キャラ(足したばかりのキャラも配れる) */
function allCharacters() {
  const map = new Map();
  G.CHARACTERS.forEach(c => map.set(c.id, c));
  draft().characters.forEach(c => map.set(c.id, c));
  return Array.from(map.values());
}

/** 中身を「💎45」のように読める形にする */
function rewardText(g) {
  const parts = [];
  if (g.char) {
    const ch = allCharacters().find(c => c.id === g.char);
    parts.push(ch ? `${ch.portrait || '🙂'}${ch.name}` : g.char);
  }
  REWARDS.forEach(r => { if (g[r.key]) parts.push(`${r.icon}${g[r.key]}`); });
  return parts.join(' ') || '(空)';
}

function periodText(g) {
  if (!g.from && !g.to) return '期間なし(すぐ配る)';
  return `${g.from || 'いつでも'} 〜 ${g.to || 'いつまでも'}`;
}

/* ===================== 一覧 ===================== */

function renderList(view) {
  const list = draft().gifts || [];
  view.innerHTML = `
    ${card('プレゼント', `
      <p class="lead">プレゼントボックスへ配ります。受け取りはプレイヤーの操作なので、
        知らないうちに増えていることはありません。</p>
      <div class="note"><b>key が配布の目印</b>です。端末は受け取った key を覚えていて、
        同じ key は二度と配りません。配り直したいときは新しい key で作ってください。</div>
      ${list.length ? `<div class="scroll-x"><table class="data">
        <tr><th>key</th><th>内容</th><th>期間</th><th></th></tr>
        ${list.map(g => `<tr>
          <td class="mono">${esc(g.key)}<br><span class="small">${esc(g.title || '')}</span></td>
          <td>${esc(rewardText(g))}</td>
          <td class="small">${esc(periodText(g))}</td>
          <td><button class="btn tiny" data-edit="${esc(g.key)}">編集</button></td>
        </tr>`).join('')}
      </table></div>` : '<p class="empty">まだ何も作っていません。</p>'}`,
      '<button class="btn primary" id="newGift">＋ プレゼントを作る</button>')}
  `;

  $('newGift').addEventListener('click', () => {
    editing = {
      key: `gift_${Date.now().toString(36)}`, title: '', note: '',
      from: today(), to: '', coin: 0, orb: 0, frepo: 0, stamina: 0, char: '', _new: true
    };
    renderEditor(view);
  });
  view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    editing = { ...find('gifts', b.dataset.edit), _new: false };
    renderEditor(view);
  }));
}

/* ===================== 編集 ===================== */

function renderEditor(view) {
  const g = editing;
  const chars = allCharacters();

  view.innerHTML = `
    ${card(g._new ? 'プレゼントを作る' : `${g.key} を編集`, `
      ${field('key', 'key', g.key, { hint: '配布の目印。配り直すときは新しい key にする' })}
      ${field('見出し', 'title', g.title, { placeholder: '例: エミリ実装記念' })}
      ${field('ひとこと', 'note', g.note, { type: 'textarea', rows: 2,
        placeholder: '例: 遊んでくれてありがとうございます!' })}

      <h3 style="margin-top:12px">配布期間</h3>
      <p class="lead small">空にすると期間を設けません。期間前の人には配らずに見送り、
        期間に入ってから配ります。期間を過ぎたら配りません。</p>
      <div class="grid2">
        ${field('開始', 'from', g.from, { type: 'date' })}
        ${field('終了', 'to', g.to, { type: 'date' })}
      </div>

      <h3 style="margin-top:12px">中身</h3>
      <div class="grid2">
        ${REWARDS.map(r => field(`${r.icon} ${r.label}`, r.key, g[r.key] || 0,
          { type: 'number', min: 0, max: r.max })).join('')}
      </div>
      ${field('キャラクター', 'char', g.char, {
        type: 'select', hint: '受け取るとそのまま所持に加わる',
        options: [['', '(なし)']].concat(chars.map(c =>
          [c.id, `${c.name} ★${c.rarity} ${G.AURA_NAME[c.aura]}`]))
      })}

      <div class="row-btns" style="margin-top:14px">
        <button class="btn primary" id="saveGift">下書きに保存</button>
        <button class="btn" id="cancelGift">やめる</button>
        ${find('gifts', g.key) ? '<button class="btn danger" id="dropGift">下書きから消す</button>' : ''}
      </div>`)}
  `;

  $('saveGift').addEventListener('click', () => {
    const v = readForm(view.querySelector('.card'));
    const key = String(v.key || '').trim();
    if (!/^[a-z0-9_]+$/i.test(key)) { toast('key は英数字とアンダースコアだけにしてください', 'ng'); return; }
    if (!String(v.title || '').trim()) { toast('見出しを入れてください', 'ng'); return; }
    if (v.from && v.to && v.from > v.to) { toast('終了が開始より前になっています', 'ng'); return; }

    const out = { key, title: String(v.title).trim() };
    if (String(v.note || '').trim()) out.note = String(v.note).trim();
    if (v.from) out.from = v.from;
    if (v.to) out.to = v.to;
    REWARDS.forEach(r => { const n = Number(v[r.key]) || 0; if (n > 0) out[r.key] = n; });
    if (v.char) out.char = v.char;

    if (!out.char && !REWARDS.some(r => out[r.key])) { toast('中身が空です', 'ng'); return; }
    upsert('gifts', out);
    toast('下書きに保存しました', 'ok');
    editing = null;
    renderList(view);
  });
  $('cancelGift').addEventListener('click', () => { editing = null; renderList(view); });
  const drop = $('dropGift');
  if (drop) drop.addEventListener('click', async () => {
    if (!await confirmAsk('下書きから消す', `${g.key} を捨てますか？`, '消す')) return;
    remove('gifts', g.key);
    editing = null;
    renderList(view);
  });
}

export default {
  render(view) {
    if (editing) renderEditor(view); else renderList(view);
  }
};
