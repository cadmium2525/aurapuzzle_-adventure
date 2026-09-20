/* =========================================================
 * character.js — キャラクター画面
 *
 * ホームの「キャラクター」からは4つの入口を出し、そこから
 *   編成 / 強化・進化 / 開眼 / 送還
 * の各ページへ潜る(図鑑は別枠のおまけ)。
 *
 * 強化・進化 / 開眼 / 送還 は同じアイコン一覧を使い回し、
 * アイコンに重ねる情報とタップしたときの動きだけをページで変える。
 * 詳細モーダルもページごとに必要な箱だけを出す(全部出すと迷うため)。
 * =======================================================*/
import { $, toast, itemIcon, charIcon } from '../core/ui.js';
import { isAvailable } from '../data/availability.js';
import {
  state, saveState, ownedCharacters, resolveOwned, entryOf,
  evolveCheck, evolveCharacter, materialCount,
  awakenCheck, awakenCharacter, dismissCheck, dismissMany, useExpItem,
  TEAM_PRESETS, activeTeam, setTeamIndex, setTeamSlot, charactersOfTeam, teamsWith
} from '../core/state.js';
import { updateStatusBar, registerBackHandler } from '../core/nav.js';
import {
  AURAS, COLOR_HEX, CHARACTERS, characterById, resolveCharacter, TEAM_SIZE,
  BASE_PARTY_HP, BASE_DRAG_TIME, MATERIALS, materialById, RARITY_TITLE, RARITY_HEX, ROLE_LABEL,
  awakenStepsFor, awakenMaxFor, EXP_ITEMS, maxLevelFor, finalStarOf
} from '../data/gamedata.js';
import { charDetailHTML, portraitHTML, awakenPipsHTML, stars, levelBarHTML } from './parts.js';

/** いま開いているページ。'menu' | 'team' | 'enhance' | 'awaken' | 'dismiss' | 'catalog' */
let page = 'menu';
/** 詳細モーダルで開いているキャラ */
let detailId = null;
/** 編成で入れ替え中の枠。null なら選択モーダルは閉じている */
let pickSlot = null;

/* 一覧の並び順。ページをまたいでも同じ基準で見たいので共通で持つ */
const SORTS = [
  { key: 'get',    label: '入手順', cmp: (a, b) => b.acquiredAt - a.acquiredAt },
  { key: 'rarity', label: 'レア度', cmp: (a, b) => b.star - a.star },
  { key: 'aura',   label: 'オーラ', cmp: (a, b) => a.aura - b.aura },
  { key: 'level',  label: 'レベル', cmp: (a, b) => b.level - a.level },
  { key: 'awaken', label: '開眼',   cmp: (a, b) => b.awaken - a.awaken },
  { key: 'count',  label: '所持数', cmp: (a, b) => b.count - a.count }
];
let sortKey = 'get';

/* 送還の複数選択。{charId: 送還する数} */
let bulkMode = false;
let bulkPicks = new Map();

export function initCharacter() {
  document.querySelectorAll('[data-charpage]').forEach(el => {
    el.addEventListener('click', () => openPage(el.dataset.charpage));
  });
  registerBackHandler('character', () => {
    if (page === 'menu') return false;
    openPage('menu');
    return true;
  });

  $('charDetailCloseBtn').addEventListener('click', closeDetail);
  $('charDetailModal').addEventListener('click', e => {
    if (e.target === $('charDetailModal')) closeDetail();
  });
  $('charEvolveBtn').addEventListener('click', doEvolve);
  $('charAwakenBtn').addEventListener('click', () => doAwaken(false));
  $('charAwakenTokenBtn').addEventListener('click', () => doAwaken(true));
  $('evoResultCloseBtn').addEventListener('click', () => {
    $('evoResultModal').classList.remove('show');
  });

  $('teamPickCloseBtn').addEventListener('click', closeTeamPick);
  $('teamPickModal').addEventListener('click', e => {
    if (e.target === $('teamPickModal')) closeTeamPick();
  });
  $('teamPickClearBtn').addEventListener('click', () => {
    if (pickSlot === null) return;
    setTeamSlot(state.teamIndex, pickSlot, null);
    closeTeamPick();
    renderTeamPage();
  });

  $('charBulkToggleBtn').addEventListener('click', () => setBulkMode(!bulkMode));
  $('charBulkDupBtn').addEventListener('click', selectDuplicates);
  initDismissModal();
}

/* ===================== ページ切り替え ===================== */
function openPage(next) {
  page = next;
  setBulkMode(false);
  renderCharacterScreen();
  window.scrollTo({ top: 0 });
}

export function renderCharacterScreen() {
  $('charMenu').hidden = page !== 'menu';
  $('charTeamPage').hidden = page !== 'team';
  $('charCatalogPage').hidden = page !== 'catalog';
  $('charListPage').hidden = !isListPage();

  if (page === 'team') { renderTeamPage(); return; }
  if (page === 'catalog') { renderCatalog(); return; }
  if (isListPage()) renderListPage();
}

function isListPage() { return page === 'enhance' || page === 'awaken' || page === 'dismiss'; }

/* ===================== 編成ページ ===================== */
/** プリセットの切り替えタブ。並びの3人をアイコンで覗けるようにする */
function renderPresetBar() {
  const bar = $('presetBar');
  bar.innerHTML = '';
  for (let i = 0; i < TEAM_PRESETS; i++) {
    const members = charactersOfTeam(i);
    const b = document.createElement('button');
    b.className = 'preset-btn' + (i === state.teamIndex ? ' active' : '');
    b.innerHTML = `<b>チーム${i + 1}</b>
      <span class="preset-faces">${members.length
        ? members.map(m => `<i class="preset-face">${charIcon(m.art && m.art.icon, m.portrait, 'pf')}</i>`).join('')
        : '<i class="preset-face empty">＋</i>'}</span>`;
    b.addEventListener('click', () => { setTeamIndex(i); renderTeamPage(); });
    bar.appendChild(b);
  }
}

function renderTeamPage() {
  renderPresetBar();
  const team = activeTeam();
  const slotsEl = $('teamSlots');
  slotsEl.innerHTML = '';

  for (let i = 0; i < TEAM_SIZE; i++) {
    const ch = team[i] ? resolveOwned(team[i]) : null;
    const div = document.createElement('button');
    div.type = 'button';
    div.className = 'teamslot' + (ch ? ' filled' : '');
    if (ch) {
      div.style.setProperty('--aura', COLOR_HEX[AURAS[ch.aura].key]);
      div.innerHTML = `
        <span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        ${portraitHTML(ch)}
        <span class="slot-name">${ch.name}</span>
        <span class="slot-lv">Lv${ch.level}</span>`;
    } else {
      div.innerHTML = `<span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        <span class="slot-empty">＋</span><span class="slot-name">空き</span>`;
    }
    div.addEventListener('click', () => openTeamPick(i));
    slotsEl.appendChild(div);
  }

  const sup = document.createElement('div');
  sup.className = 'teamslot support-slot';
  sup.innerHTML = `<span class="slot-label">サポート</span>
    <span class="slot-empty">🤝</span>
    <span class="slot-name">出発時に選択</span>`;
  slotsEl.appendChild(sup);

  // パーティ概要
  const members = charactersOfTeam(state.teamIndex);
  const totalHP = BASE_PARTY_HP + members.reduce((s, m) => s + m.hp, 0);
  const auraSet = [...new Set(members.map(m => m.aura))]
    .map(a => `<span class="aura-chip" style="--aura:${COLOR_HEX[AURAS[a].key]}">${AURAS[a].emoji}${AURAS[a].name}</span>`)
    .join('');
  const ls = members.length ? members[0].leaderSkill : null;
  const extraTime = (ls && ls.time) ? ls.time : 0;
  $('teamSummary').innerHTML = members.length ? `
    <div class="ts-row"><span>合計HP(サポート除く)</span><b>${totalHP}</b></div>
    <div class="ts-row"><span>攻撃できるオーラ</span><b class="aura-chips">${auraSet}</b></div>
    <div class="ts-row"><span>操作時間(自陣LSのみ)</span><b>${((BASE_DRAG_TIME / 1000) + extraTime).toFixed(1)}秒</b></div>`
    : '<div class="empty">枠をタップしてキャラクターを編成してください。</div>';

  $('teamLeaderSkill').innerHTML = ls
    ? `<div class="skill-line on"><span class="skill-tag ls">LS</span>
         <span><b>${ls.name}</b><br>${ls.desc}</span></div>
       <div class="mstats mt6">サポート枠のリーダースキルも発動します(ダンジョン出発時に選択)。</div>`
    : '<div class="empty">リーダーが未設定です。</div>';
}

/* ===================== 編成の入れ替えモーダル ===================== */
function openTeamPick(slot) {
  pickSlot = slot;
  $('teamPickTitle').textContent = slot === 0 ? 'リーダーを選ぶ' : `サブ${slot}を選ぶ`;
  $('teamPickClearBtn').hidden = !activeTeam()[slot];
  renderSortBar($('teamPickSortBar'), renderTeamPickGrid);
  renderTeamPickGrid();
  $('teamPickModal').classList.add('show');
  $('teamPickGrid').scrollTop = 0;
}

function closeTeamPick() {
  $('teamPickModal').classList.remove('show');
  pickSlot = null;
}

function renderTeamPickGrid() {
  const team = activeTeam();
  const grid = $('teamPickGrid');
  grid.innerHTML = '';
  const list = sortedOwned();
  if (!list.length) {
    grid.innerHTML = '<div class="empty">まだ仲間がいません。ガチャやショップで増やしましょう。</div>';
    return;
  }
  list.forEach(ch => {
    const at = team.indexOf(ch.id);
    const cell = gridCell(ch, {
      badge: at >= 0 ? (at === 0 ? 'リーダー' : 'サブ' + at) : '',
      selected: at === pickSlot
    });
    cell.addEventListener('click', () => {
      setTeamSlot(state.teamIndex, pickSlot, ch.id);
      closeTeamPick();
      renderTeamPage();
    });
    grid.appendChild(cell);
  });
}

/* ===================== 一覧(強化・進化 / 開眼 / 送還) ===================== */
const LIST_TITLE = { enhance: '強化・進化', awaken: '開眼', dismiss: '送還' };

function sortedOwned() {
  const sort = SORTS.find(s => s.key === sortKey) || SORTS[0];
  // 基準が並んだときは名前で決める。並びが実行のたびに変わらないようにする
  return ownedCharacters().sort((a, b) => sort.cmp(a, b) || a.name.localeCompare(b.name, 'ja'));
}

function renderSortBar(bar, onChange) {
  bar.innerHTML = '';
  SORTS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'sort-btn' + (s.key === sortKey ? ' active' : '');
    b.textContent = s.label;
    b.addEventListener('click', () => { sortKey = s.key; renderSortBar(bar, onChange); onChange(); });
    bar.appendChild(b);
  });
}

/**
 * 一覧のセル1つ。アイコンにページごとの情報を重ねる。
 * @param {object} opts {badge, corner, selected, dim}
 */
function gridCell(ch, opts = {}) {
  const aura = AURAS[ch.aura];
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cg-cell' + (opts.selected ? ' selected' : '') + (opts.dim ? ' dim' : '');
  cell.style.setProperty('--aura', COLOR_HEX[aura.key]);
  cell.style.setProperty('--rare', RARITY_HEX[ch.star]);
  cell.innerHTML = `
    <span class="cg-face">${charIcon(ch.art && ch.art.icon, ch.portrait, 'cg')}</span>
    ${opts.corner ? `<span class="cg-corner">${opts.corner}</span>` : ''}
    <span class="cg-star">★${ch.star}</span>
    <span class="cg-lv">Lv${ch.level}</span>
    ${opts.badge ? `<span class="cg-badge">${opts.badge}</span>` : ''}
    <span class="cg-name">${ch.name}</span>`;
  return cell;
}

function renderListPage() {
  $('charListTitle').textContent = LIST_TITLE[page];
  $('charListActions').hidden = page !== 'dismiss';
  renderMaterials();
  renderSortBar($('charSortBar'), renderGrid);
  renderGrid();
}

function renderGrid() {
  const grid = $('charGrid');
  grid.innerHTML = '';
  const list = sortedOwned();
  $('charListCount').textContent = `${list.length} 人`;
  if (!list.length) {
    grid.innerHTML = '<div class="empty">まだ仲間がいません。ガチャやショップで増やしましょう。</div>';
    renderBulkBar();
    return;
  }
  list.forEach(ch => {
    const cell = gridCell(ch, cellDecoration(ch));
    cell.addEventListener('click', () => onCellTap(ch));
    grid.appendChild(cell);
  });
  renderBulkBar();
}

/** ページごとにアイコンへ重ねる情報 */
function cellDecoration(ch) {
  if (page === 'awaken') {
    const max = ch.awakenMax || 4;
    return { corner: `<span class="cg-pips">${awakenPipsHTML(ch.awaken, max)}</span>` };
  }
  if (page === 'dismiss') {
    const picked = bulkPicks.has(ch.id);
    return {
      corner: ch.count > 1 ? `<span class="cg-count">×${ch.count}</span>` : '',
      badge: teamsWith(ch.id).length ? '編成中' : '',
      selected: bulkMode && picked
    };
  }
  // 強化・進化:進化できるものを目立たせる
  return {
    corner: ch.count > 1 ? `<span class="cg-count">×${ch.count}</span>` : '',
    badge: evolveCheck(ch.id).ok ? '進化可' : ''
  };
}

function onCellTap(ch) {
  if (page === 'dismiss') {
    if (bulkMode) { toggleBulk(ch); return; }
    openDismissModal(ch.id);
    return;
  }
  openDetail(ch.id, page);
}

/** 強化・進化と開眼で使う素材の所持数 */
function renderMaterials() {
  const box = $('charMaterials');
  if (page === 'dismiss') { box.hidden = true; return; }
  const ids = page === 'awaken'
    ? ['mt_awaken']
    : MATERIALS.map(mt => mt.id).filter(id => id !== 'mt_awaken');
  box.hidden = false;
  box.innerHTML = ids.map(id => {
    const mt = materialById(id);
    return `<div class="mt-chip" style="--mt:${mt.color}" title="${mt.name}">
      ${itemIcon(mt.id, 'material')}
      <span class="mt-name">${mt.name}</span>
      <b class="mt-count">${materialCount(mt.id)}</b>
    </div>`;
  }).join('');
}

/* ===================== 送還 ===================== */
function setBulkMode(on) {
  bulkMode = !!on && page === 'dismiss';
  bulkPicks = new Map();
  const btn = $('charBulkToggleBtn');
  if (btn) {
    btn.textContent = bulkMode ? 'まとめて送還をやめる' : 'まとめて送還';
    btn.classList.toggle('active', bulkMode);
  }
  const dup = $('charBulkDupBtn');
  if (dup) dup.hidden = !bulkMode;
  if (isListPage()) { renderGrid(); }
}

function toggleBulk(ch) {
  if (bulkPicks.has(ch.id)) bulkPicks.delete(ch.id);
  else bulkPicks.set(ch.id, ch.count);       // 単体モーダルと同じく既定は手持ち全部
  renderGrid();
}

/** 被り(2体以上)だけを、1体残す数で選ぶ */
function selectDuplicates() {
  bulkPicks = new Map();
  ownedCharacters().forEach(ch => {
    if (ch.count > 1) bulkPicks.set(ch.id, ch.count - 1);
  });
  if (!bulkPicks.size) toast('被っているキャラクターがいません');
  renderGrid();
}

function renderBulkBar() {
  const bar = $('charBulkBar');
  if (!bulkMode) { bar.hidden = true; bar.innerHTML = ''; return; }
  const picks = [...bulkPicks.entries()].map(([id, count]) => ({ id, count }));
  const total = picks.reduce((s, p) => s + p.count, 0);
  const gained = {};
  let coin = 0;
  picks.forEach(p => {
    const check = dismissCheck(p.id, p.count);
    if (!check.ok) return;
    Object.keys(check.total.materials).forEach(id => {
      gained[id] = (gained[id] || 0) + check.total.materials[id];
    });
    coin += check.total.coin;
  });
  bar.hidden = false;
  bar.innerHTML = `
    <div class="bulk-info"><b>${picks.length}</b> 種 ・ <b>${total}</b> 体
      <span class="bulk-gain">${rewardText(gained, coin) || '—'}</span></div>
    <button class="btn danger" id="bulkRunBtn"${total ? '' : ' disabled'}>まとめて送還</button>`;
  const run = $('bulkRunBtn');
  if (run) run.addEventListener('click', () => runDismiss(picks));
}

function rewardText(materials, coin) {
  const parts = Object.keys(materials)
    .filter(id => materials[id] > 0)
    .map(id => `${itemIcon(id)}${materials[id]}`);
  if (coin > 0) parts.push(`${itemIcon('coin')}${coin.toLocaleString()}`);
  return parts.join(' ');
}

function initDismissModal() {
  $('dismissCancelBtn').addEventListener('click', closeDismissModal);
  $('dismissModal').addEventListener('click', e => {
    if (e.target === $('dismissModal')) closeDismissModal();
  });
  $('dismissMinusBtn').addEventListener('click', () => stepDismiss(-1));
  $('dismissPlusBtn').addEventListener('click', () => stepDismiss(1));
  $('dismissDoBtn').addEventListener('click', () => {
    if (!detailId) return;
    runDismiss([{ id: detailId, count: dismissCount }]);
  });
}

let dismissCount = 1;

function openDismissModal(id) {
  detailId = id;
  const e = entryOf(id);
  if (!e) return;
  dismissCount = e.n;                    // 初期値は手持ちと同じ数
  renderDismissModal();
  $('dismissModal').classList.add('show');
}

function closeDismissModal() {
  $('dismissModal').classList.remove('show');
  detailId = null;
}

function stepDismiss(dir) {
  const e = entryOf(detailId);
  if (!e) return;
  dismissCount = Math.max(1, Math.min(e.n, dismissCount + dir));
  renderDismissModal();
}

function renderDismissModal() {
  const ch = resolveOwned(detailId);
  if (!ch) return;
  const check = dismissCheck(detailId, dismissCount);
  const teams = teamsWith(detailId).map(i => `チーム${i + 1}`);
  const all = dismissCount >= ch.count;
  $('dismissBody').innerHTML = `
    <div class="dismiss-head">${portraitHTML(ch)}
      <div><b>${ch.name}</b><span>${stars(ch.star)} Lv${ch.level} ・ 手持ち ${ch.count}</span></div>
    </div>
    ${all && teams.length
      ? `<div class="evo-note warn">${teams.join('・')}に編成されています。全部送還すると枠から外れます。</div>`
      : ''}
    ${all ? '<div class="evo-note warn">手持ちからいなくなります。</div>' : ''}`;
  $('dismissCount').textContent = dismissCount;
  $('dismissMax').textContent = `/ ${ch.count}`;
  $('dismissMinusBtn').disabled = dismissCount <= 1;
  $('dismissPlusBtn').disabled = dismissCount >= ch.count;
  $('dismissReward').innerHTML =
    `<span class="dr-label">獲得</span>${rewardText(check.total.materials, check.total.coin)}`;
}

function runDismiss(picks) {
  const total = picks.reduce((s, p) => s + p.count, 0);
  if (!total) return;
  const names = picks.map(p => {
    const base = characterById(p.id);
    return `${base ? base.name : p.id}×${p.count}`;
  });
  const head = names.length > 3 ? `${names.slice(0, 3).join(' / ')} ほか${names.length - 3}種` : names.join(' / ');
  // 手持ちが0になるキャラは編成からも消えるので、名前を出して確かめてもらう
  const leaving = picks
    .filter(p => { const e = entryOf(p.id); return e && p.count >= e.n && teamsWith(p.id).length; })
    .map(p => { const base = characterById(p.id); return base ? base.name : p.id; });
  const warn = leaving.length
    ? `\n\n⚠ ${leaving.join('・')} は編成から外れます。` : '';
  if (!confirm(`${head}\n合計${total}体を送還します。よろしいですか?${warn}`)) return;
  const res = dismissMany(picks);
  if (!res.ok) { toast(res.message); return; }
  const gained = Object.keys(res.gained).map(k => `${materialById(k).emoji}${res.gained[k]}`).join(' ');
  toast(`${res.count}体を送還: ${gained} 💰${res.coin.toLocaleString()}`);
  closeDismissModal();
  setBulkMode(false);
  updateStatusBar();
  renderCharacterScreen();
}

/* ===================== 進化 ===================== */
function renderEvolveBox(id) {
  const box = $('charEvolveBox');
  const btn = $('charEvolveBtn');
  const e = entryOf(id);
  if (!e) { box.hidden = true; btn.hidden = true; return; }

  const check = evolveCheck(id);
  const base = characterById(id);
  box.hidden = false;

  if (!check.need) {                       // ★5到達済み
    box.innerHTML = `<div class="evo-title">進化</div>
      <div class="evo-done">✨ 最終進化に到達しています</div>`;
    btn.hidden = true;
    return;
  }

  const need = check.need;
  const crystal = materialById(need.crystalId);
  const lvOK = e.lv >= need.level;
  const cOK = materialCount(need.crystalId) >= need.crystal;
  const sOK = materialCount('mt_star') >= need.shard;
  const coinOK = state.coin >= need.coin;
  const after = resolveCharacter(id, check.nextStar, Math.min(e.lv, 99));
  const now = resolveOwned(id);

  const req = (ok, label, have, want) =>
    `<div class="evo-req${ok ? ' ok' : ''}"><span>${label}</span>
      <b>${have} / ${want}</b>${ok ? '<i>✔</i>' : ''}</div>`;

  box.innerHTML = `
    <div class="evo-title">進化 ★${e.star} → ★${check.nextStar}
      <span class="evo-next">${RARITY_TITLE[check.nextStar]}</span></div>
    <div class="evo-reqs">
      ${req(lvOK, 'レベル', e.lv, need.level)}
      ${req(cOK, `${itemIcon(crystal.id)} ${crystal.name}`, materialCount(need.crystalId), need.crystal)}
      ${req(sOK, `${itemIcon('mt_star')} 進化の輝石`, materialCount('mt_star'), need.shard)}
      ${req(coinOK, `${itemIcon('coin')} コイン`, state.coin.toLocaleString(), need.coin.toLocaleString())}
    </div>
    <div class="evo-preview">
      <div class="evo-col"><span>ATK</span><b>${now.atk}</b><i>→</i><b class="up">${after.atk}</b></div>
      <div class="evo-col"><span>HP</span><b>${now.hp}</b><i>→</i><b class="up">${after.hp}</b></div>
      <div class="evo-col"><span>RCV</span><b>${now.rcv}</b><i>→</i><b class="up">${after.rcv}</b></div>
    </div>
    <div class="evo-skillup">
      <div class="skill-line on"><span class="skill-tag ls">LS</span>
        <span><b>${after.leaderSkill.name}</b><br>${after.leaderSkill.desc}</span></div>
      <div class="skill-line on"><span class="skill-tag sk">SKILL</span>
        <span><b>${after.skill.name}</b>(CT ${after.skill.cooldown})<br>${after.skill.desc}</span></div>
    </div>
    ${base.artStages && base.artStages.length > 1 ? '<div class="evo-note">✨ 進化でイラストが変化します</div>' : ''}
    ${check.ok ? '' : `<div class="evo-note warn">${check.reason}</div>`}`;

  btn.hidden = false;
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `★${check.nextStar} へ進化する` : '進化できません';
}

/* ===================== 開眼 ===================== */
function renderAwakenBox(id) {
  const box = $('charAwakenBox');
  const btn = $('charAwakenBtn');
  const tokenBtn = $('charAwakenTokenBtn');
  const e = entryOf(id);
  const base = characterById(id);
  if (!e || !base) { box.hidden = true; btn.hidden = true; tokenBtn.hidden = true; return; }

  const max = awakenMaxFor(base);
  const cur = Math.min(max, e.awa || 0);
  const steps = awakenStepsFor(base);
  const check = awakenCheck(id, false);
  const tokenCheck = awakenCheck(id, true);
  box.hidden = false;

  const rows = steps.map((st, i) => {
    const done = i < cur;
    const next = i === cur;
    return `<div class="aw-row${done ? ' done' : ''}${next ? ' next' : ''}">
      <span class="aw-no">${i + 1}</span>
      <span class="aw-eff">${st.label}</span>
      ${done ? '<i>✔</i>' : (next ? '<i class="aw-nexttag">次</i>' : '')}
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="evo-title">開眼 ${awakenPipsHTML(cur, max)}
      <span class="evo-next">${cur} / ${max}</span></div>
    <div class="aw-list">${rows}</div>
    <div class="evo-req${check.ok ? ' ok' : ''}">
      <span>同じキャラクター(本体含む)</span><b>${e.n || 0} / ${(check.copies || 0) + 1}</b>${check.ok ? '<i>✔</i>' : ''}
    </div>
    <div style="${base.raidDrop ? 'display:none' : ''}" class="evo-req${tokenCheck.ok ? ' ok' : ''}">
      <span>${itemIcon('mt_awaken')} 開眼の証</span><b>${materialCount('mt_awaken')} / ${check.tokenCost}</b>${tokenCheck.ok ? '<i>✔</i>' : ''}
    </div>
    <div class="evo-note">${cur >= max ? '最大まで開眼済みです。' : base.raidDrop ? `同じキャラクターを${check.copies}体消費します。最大10段階。開眼の証は使用できません。` : `同じキャラクター1体、または開眼の証${check.tokenCost}個のどちらかを使います。`}</div>`;

  if (cur >= max) { btn.hidden = true; tokenBtn.hidden = true; return; }
  btn.hidden = false;
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `同キャラで開眼(${cur + 1}段階目)` : '同キャラが足りません';
  tokenBtn.hidden = !!base.raidDrop;
  tokenBtn.disabled = !tokenCheck.ok;
  tokenBtn.textContent = tokenCheck.ok
    ? `開眼の証×${check.tokenCost}で開眼` : `開眼の証が足りません(${check.tokenCost}個)`;
}

/* ===================== 詳細モーダルの書き換え =====================
 * レベルや開眼の段階が変わっただけで innerHTML を丸ごと入れ替えると、
 * 立ち絵の <img> まで作り直されて読み込み直しが走り、画面がガタつく。
 * 変わったところだけ書き換え、絵が差し替わるときだけ作り直す。
 * ================================================================ */

/** いま表示している立ち絵のパス(作り直しの要否を見るため) */
function shownArtSrc() {
  const img = $('charDetailBody').querySelector('.cd-art img');
  return img ? img.getAttribute('src') : null;
}

/**
 * 詳細モーダルを、いまの所持データに合わせて更新する。
 * 立ち絵が変わる(進化・段階の切り替わり)ときだけ作り直す。
 */
function refreshDetail(id) {
  const body = $('charDetailBody');
  const ch = resolveOwned(id);
  const artNow = (ch && ch.art && ch.art.full) || null;
  const artShown = shownArtSrc();
  // 絵そのものが変わるなら、素直に作り直して見せる
  if (!ch || !body.querySelector('.cd-head') || artNow !== artShown) {
    openDetail(id, detailMode, false);
    return;
  }
  const lv = body.querySelector('.lvbar');
  if (lv) lv.outerHTML = levelBarHTML(ch);
  const stats = body.querySelector('.cd-stats');
  if (stats) {
    stats.innerHTML = `
      <div><span>ATK</span><b>${ch.atk}</b></div>
      <div><span>HP</span><b>${ch.hp}</b></div>
      <div><span>RCV</span><b>${ch.rcv}</b></div>`;
  }
  const tags = body.querySelector('.cd-tags');
  if (tags) {
    const aura = AURAS[ch.aura];
    tags.innerHTML = `<span class="chip aura">${aura.emoji} ${aura.name}オーラ</span>
      <span class="chip">${ROLE_LABEL[ch.role] || ch.role}</span>
      ${ch.evolved ? '<span class="chip evo">進化済</span>' : ''}
      ${ch.awaken ? `<span class="chip awa">開眼 ${ch.awaken}</span>` : ''}`;
  }
  if (detailMode === 'enhance') { renderExpBox(id); renderEvolveBox(id); }
  if (detailMode === 'awaken') renderAwakenBox(id);
}

/* ===================== 育成(経験値アイテム) ===================== */
function renderExpBox(id) {
  const box = $('charExpBox');
  const e = entryOf(id);
  if (!e) { box.hidden = true; return; }
  const max = maxLevelFor(e.star);
  const atMax = e.lv >= max;
  const items = Object.keys(EXP_ITEMS).filter(k => materialCount(k) > 0);

  box.hidden = false;
  if (atMax) {
    box.innerHTML = `<div class="evo-title">強化</div>
      <div class="evo-done">Lv${max} に到達しています</div>`;
    return;
  }
  if (!items.length) {
    box.innerHTML = `<div class="evo-title">強化</div>
      <div class="evo-note">経験値アイテムがありません。曜日ダンジョン(土日)で手に入ります。</div>`;
    return;
  }
  box.innerHTML = `<div class="evo-title">強化
      <span class="evo-next">Lv${e.lv} / ${max}</span></div>
    <div class="aw-list">${items.map(k => {
      const mt = materialById(k);
      return `<div class="aw-row next" data-item="${k}">
        <span class="aw-eff">${itemIcon(mt.id)} ${mt.name} <b>×${materialCount(k)}</b>(1個 +${EXP_ITEMS[k]}exp)</span>
        <button class="btn ghost tiny expbtn" data-item="${k}">1個使う</button>
        <button class="btn ghost tiny expbtn" data-item="${k}" data-all="1">全部使う</button>
      </div>`;
    }).join('')}</div>`;

  box.querySelectorAll('.expbtn').forEach(b => {
    b.addEventListener('click', () => {
      const n = b.dataset.all ? materialCount(b.dataset.item) : 1;
      const res = useExpItem(id, b.dataset.item, n);
      if (!res.ok) { toast(res.message); return; }
      toast(res.to > res.from ? `Lv${res.from} → Lv${res.to}` : `経験値+${res.exp}`);
      updateStatusBar();
      // 一覧は閉じるときに作り直す(開いている間に触ると裏で絵が読み直される)
      refreshDetail(id);
    });
  });
}

function doAwaken(useToken) {
  if (!detailId) return;
  const res = awakenCharacter(detailId, useToken);
  if (!res.ok) { toast(res.message); return; }
  toast(`開眼 ${res.to} 段階目: ${res.step ? res.step.label : ''}`);
  updateStatusBar();
  refreshDetail(detailId);
}

function doEvolve() {
  if (!detailId) return;
  const res = evolveCharacter(detailId);
  if (!res.ok) { toast(res.message); return; }
  saveState();
  updateStatusBar();
  showEvolveResult(res.before, res.after);
  openDetail(detailId, detailMode, false);
  renderCharacterScreen();
}

/** 進化の演出モーダル */
function showEvolveResult(before, after) {
  const aura = AURAS[after.aura];
  $('evoResultBody').innerHTML = `
    <div class="evo-burst"></div>
    <div class="evo-res-head" style="--aura:${COLOR_HEX[aura.key]}">
      ${portraitHTML(after, 'big')}
    </div>
    <div class="evo-res-name">${after.name}</div>
    <div class="evo-res-star">★${before.star} → <b>★${after.star}</b></div>
    <div class="evo-res-stats">
      <div><span>ATK</span><b>${before.atk} → ${after.atk}</b></div>
      <div><span>HP</span><b>${before.hp} → ${after.hp}</b></div>
      <div><span>RCV</span><b>${before.rcv} → ${after.rcv}</b></div>
    </div>
    <div class="skill-line on"><span class="skill-tag ls">LS</span>
      <span><b>${after.leaderSkill.name}</b><br>${after.leaderSkill.desc}</span></div>
    <div class="skill-line on"><span class="skill-tag sk">SKILL</span>
      <span><b>${after.skill.name}</b>(CT ${after.skill.cooldown})<br>${after.skill.desc}</span></div>`;
  $('evoResultModal').classList.add('show');
}

/* ===================== 詳細モーダル =====================
 * ページに関係する段だけを出す。全部出すと何を見ればいいか分からないため。
 *   'enhance'  立ち絵 + レベル + ステータス + 強化 + 進化
 *              (進化後のLS/スキルは進化の箱が見せるので、ここには出さない)
 *   'awaken'   立ち絵 + 開眼の段階と必要な素材だけ
 *   'catalog'  図鑑なので全部
 * ======================================================== */
let detailMode = 'enhance';

/** mode ごとに、詳細のどの段を出すか */
const DETAIL_SECTIONS = {
  enhance: { flavor: false, level: true,  stats: true,  skills: false },
  awaken:  { flavor: false, level: false, stats: false, skills: false }
};

function openDetail(id, mode, resetScroll = true) {
  detailId = id;
  detailMode = mode;
  const base = characterById(id);
  const owned = !!entryOf(id);
  const isCatalog = mode === 'catalog' || mode === 'catalogEvo';
  const previewStar = mode === 'catalogEvo' ? finalStarOf(base) : base.rarity;
  const ch = isCatalog
    ? resolveCharacter(id, previewStar, 1, 0)
    : resolveOwned(id);
  if (!ch) return;

  const formSwitch = isCatalog ? `
    <div class="segmented small catalog-switch">
      <button data-catalog-mode="catalog" class="${mode === 'catalog' ? 'active' : ''}">進化前 ★${base.rarity}</button>
      <button data-catalog-mode="catalogEvo" class="${mode === 'catalogEvo' ? 'active' : ''}">進化後 ★${finalStarOf(base)}</button>
    </div>` : '';
  const note = isCatalog
    ? `<div class="cd-note">図鑑プレビューです。${owned ? '' : 'まだ仲間にしていません。'}${base.raidDrop ? '入手先：降臨ダンジョン「九狐降臨」（基本50%）。' : ''}</div>`
    : '';
  $('charDetailBody').innerHTML = formSwitch + charDetailHTML(ch, note, DETAIL_SECTIONS[mode]);
  $('charDetailBody').querySelectorAll('[data-catalog-mode]').forEach(button => {
    button.addEventListener('click', () => openDetail(id, button.dataset.catalogMode));
  });

  // ページに関係する箱だけを出す
  const showEnhance = mode === 'enhance' && owned;
  const showAwaken = mode === 'awaken' && owned;
  if (showEnhance) { renderExpBox(id); renderEvolveBox(id); } else {
    $('charExpBox').hidden = true; $('charEvolveBox').hidden = true; $('charEvolveBtn').hidden = true;
  }
  if (showAwaken) renderAwakenBox(id); else {
    $('charAwakenBox').hidden = true; $('charAwakenBtn').hidden = true; $('charAwakenTokenBtn').hidden = true;
  }

  const modal = $('charDetailModal');
  modal.classList.add('show');
  if (resetScroll) modal.querySelector('.modal-card').scrollTop = 0;
}

function closeDetail() {
  $('charDetailModal').classList.remove('show');
  detailId = null;
  renderCharacterScreen();
}

/* ===================== 図鑑 ===================== */
function renderCatalog() {
  const el = $('allCharacterList');
  el.innerHTML = '';
  CHARACTERS.filter(c=>isAvailable(c) || entryOf(c.id))
    .sort((a, b) => a.aura - b.aura || a.rarity - b.rarity)
    .forEach(base => {
      const e = entryOf(base.id);
      const before = resolveCharacter(base, base.rarity, 1, 0);
      const after = resolveCharacter(base, finalStarOf(base), 1, 0);
      const aura = AURAS[base.aura];
      const card = document.createElement('div');
      card.className = 'catalog-card' + (e ? '' : ' unowned');
      card.style.setProperty('--aura', COLOR_HEX[aura.key]);
      const form = (ch, label, mode) => `
        <button class="catalog-form" data-mode="${mode}">
          <span class="catalog-portrait">${charIcon(ch.art && ch.art.icon, ch.portrait, 'catalog')}</span>
          <span><b>${label}</b><i>★${ch.star}</i></span>
        </button>`;
      card.innerHTML = `
        <div class="catalog-head">
          <span><b>${base.name}</b><i>${aura.emoji}${aura.name} ・ ${base.job}</i></span>
          <em>${e ? `所持 ★${e.star}` : '未所持'}</em>
        </div>
        <div class="catalog-forms">
          ${form(before, '進化前', 'catalog')}
          <span class="catalog-arrow">›</span>
          ${form(after, '進化後', 'catalogEvo')}
        </div>`;
      card.querySelectorAll('[data-mode]').forEach(button => {
        button.addEventListener('click', () => openDetail(base.id, button.dataset.mode));
      });
      el.appendChild(card);
    });
}
