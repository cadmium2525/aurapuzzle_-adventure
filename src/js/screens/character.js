/* =========================================================
 * character.js — キャラクター画面(編成 / 図鑑 / 進化)
 * 自陣は人物キャラクター3人。先頭がリーダーでリーダースキルが発動する。
 * =======================================================*/
import { $, toast, itemIcon, artImg } from '../core/ui.js';
import {
  state, saveState, ownedCharacters, ownCharacters, resolveOwned,
  entryOf, evolveCheck, evolveCharacter, materialCount,
  awakenCheck, awakenCharacter, dismissCheck, dismissCharacter, useExpItem
} from '../core/state.js';
import { updateStatusBar } from '../core/nav.js';
import {
  AURAS, COLOR_HEX, CHARACTERS, characterById, resolveCharacter, TEAM_SIZE,
  BASE_PARTY_HP, BASE_DRAG_TIME, MATERIALS, materialById, RARITY_TITLE,
  AWAKEN_MAX, awakenStepsFor, awakenMaxFor, EXP_ITEMS, maxLevelFor, crystalIdFor, finalStarOf
} from '../data/gamedata.js';
import { charRowHTML, charDetailHTML, portraitHTML, levelBarHTML, awakenPipsHTML } from './parts.js';

let tab = 'team';
let detailId = null;          // 詳細を開いているキャラのID
let detailOwned = false;

export function initCharacter() {
  $('tabTeamBtn').addEventListener('click', () => { tab = 'team'; renderCharacterScreen(); });
  $('tabListBtn').addEventListener('click', () => { tab = 'list'; renderCharacterScreen(); });
  $('charDetailCloseBtn').addEventListener('click', closeDetail);
  $('charDetailModal').addEventListener('click', e => {
    if (e.target === $('charDetailModal')) closeDetail();
  });
  $('charDetailActionBtn').addEventListener('click', () => {
    if (!detailId) return;
    toggleTeam(detailId);
    closeDetail();
  });
  $('charEvolveBtn').addEventListener('click', doEvolve);
  $('charAwakenBtn').addEventListener('click', () => doAwaken(false));
  $('charAwakenTokenBtn').addEventListener('click', () => doAwaken(true));
  $('charDismissBtn').addEventListener('click', doDismiss);
  $('evoResultCloseBtn').addEventListener('click', () => {
    $('evoResultModal').classList.remove('show');
  });
}

function closeDetail() {
  $('charDetailModal').classList.remove('show');
  detailId = null;
  renderCharacterScreen();
}

/** 編成へ入れる / 外す */
function toggleTeam(id) {
  if (state.team.includes(id)) {
    state.team = state.team.filter(x => x !== id);
  } else {
    if (state.team.filter(Boolean).length >= TEAM_SIZE) {
      toast(`編成は最大${TEAM_SIZE}人までです`); return;
    }
    state.team = state.team.filter(Boolean);
    state.team.push(id);
  }
  while (state.team.length < TEAM_SIZE) state.team.push(null);
  saveState();
  renderTeamPane();
}

/** 編成の並び替え(先頭がリーダー) */
function moveInTeam(index, dir) {
  const team = state.team.filter(Boolean);
  const to = index + dir;
  if (to < 0 || to >= team.length) return;
  [team[index], team[to]] = [team[to], team[index]];
  state.team = team;
  while (state.team.length < TEAM_SIZE) state.team.push(null);
  saveState();
  renderTeamPane();
}

export function renderCharacterScreen() {
  $('tabTeamBtn').classList.toggle('active', tab === 'team');
  $('tabListBtn').classList.toggle('active', tab === 'list');
  $('characterTeamPane').style.display = tab === 'team' ? 'flex' : 'none';
  $('characterListPane').style.display = tab === 'list' ? 'block' : 'none';
  if (tab === 'team') renderTeamPane(); else renderListPane();
}

/* ===================== 進化 ===================== */
/** 詳細モーダルの進化セクションを描く */
function renderEvolveBox(id) {
  const box = $('charEvolveBox');
  const btn = $('charEvolveBtn');
  const e = entryOf(id);
  if (!e) { box.style.display = 'none'; btn.style.display = 'none'; return; }

  const check = evolveCheck(id);
  const base = characterById(id);
  box.style.display = 'block';

  if (!check.need) {                       // ★5到達済み
    box.innerHTML = `<div class="evo-title">進化</div>
      <div class="evo-done">✨ 最終進化に到達しています</div>`;
    btn.style.display = 'none';
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

  btn.style.display = 'block';
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `★${check.nextStar} へ進化する` : '進化できません';
}

/* ===================== 開眼 ===================== */
/** 詳細モーダルの開眼セクションを描く */
function renderAwakenBox(id) {
  const box = $('charAwakenBox');
  const btn = $('charAwakenBtn');
  const e = entryOf(id);
  const base = characterById(id);
  if (!e || !base) { box.style.display = 'none'; btn.style.display = 'none'; return; }

  const max = awakenMaxFor(base);
  const cur = Math.min(max, e.awa || 0);
  const steps = awakenStepsFor(base);
  const check = awakenCheck(id, false);
  const tokenCheck = awakenCheck(id, true);
  box.style.display = 'block';

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
      <span>同じキャラクター(本体含む)</span><b>${e.n || 0} / ${(check.copies || 0)+1}</b>${check.ok ? '<i>✔</i>' : ''}
    </div>
    <div style="${base.raidDrop?'display:none':''}" class="evo-req${tokenCheck.ok ? ' ok' : ''}">
      <span>${itemIcon('mt_awaken')} 開眼の証</span><b>${materialCount('mt_awaken')} / ${check.tokenCost}</b>${tokenCheck.ok ? '<i>✔</i>' : ''}
    </div>
    <div class="evo-note">${cur>=max?'最大まで開眼済みです。':base.raidDrop?`同じキャラクターを${check.copies}体消費します。最大10段階。開眼の証は使用できません。`:`同じキャラクター1体、または開眼の証${check.tokenCost}個のどちらかを使います。`}</div>`;

  const tokenBtn = $('charAwakenTokenBtn');
  if (cur >= max) { btn.style.display = 'none'; tokenBtn.style.display = 'none'; return; }
  btn.style.display = 'block';
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? `同キャラで開眼(${cur + 1}段階目)` : '同キャラが足りません';
  tokenBtn.style.display = base.raidDrop ? 'none' : 'block';
  tokenBtn.disabled = !tokenCheck.ok;
  tokenBtn.textContent = tokenCheck.ok
    ? `開眼の証×${check.tokenCost}で開眼` : `開眼の証が足りません(${check.tokenCost}個)`;
}

/* ===================== 育成(経験値アイテム) ===================== */
function renderExpBox(id) {
  const box = $('charExpBox');
  const e = entryOf(id);
  if (!e) { box.style.display = 'none'; return; }
  const max = maxLevelFor(e.star);
  const atMax = e.lv >= max;
  const items = Object.keys(EXP_ITEMS).filter(k => materialCount(k) > 0);

  box.style.display = 'block';
  if (atMax) {
    box.innerHTML = `<div class="evo-title">育成</div>
      <div class="evo-done">Lv${max} に到達しています</div>`;
    return;
  }
  if (!items.length) {
    box.innerHTML = `<div class="evo-title">育成</div>
      <div class="evo-note">経験値アイテムがありません。曜日ダンジョン(土日)で手に入ります。</div>`;
    return;
  }
  box.innerHTML = `<div class="evo-title">育成
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
      openDetail(detailId, detailOwned, null, false);
      renderCharacterScreen();
    });
  });
}

/* ===================== 送還 ===================== */
function renderDismissBox(id) {
  const box = $('charDismissBox');
  const btn = $('charDismissBtn');
  const e = entryOf(id);
  const base = characterById(id);
  if (!e || !base) { box.style.display = 'none'; btn.style.display = 'none'; return; }

  const check = dismissCheck(id);
  const r = check.reward;
  const crystal = materialById(crystalIdFor(base.aura));
  const parts = [
    `${itemIcon(crystal.id)} ${crystal.name} ×${r.crystal}`,
    r.shard ? `${itemIcon('mt_star')} 進化の輝石 ×${r.shard}` : '',
    r.awaken ? `${itemIcon('mt_awaken')} 開眼の証 ×${r.awaken}` : '',
    `${itemIcon('coin')} ${r.coin.toLocaleString()}`
  ].filter(Boolean);

  box.style.display = 'block';
  box.innerHTML = `<div class="evo-title">送還
      <span class="evo-next">手持ち ${e.n || 0}</span></div>
    <div class="evo-note">余った被りを1体ぶん素材に変えます(最後の1体は残ります)。</div>
    <div class="aw-list"><div class="aw-row done"><span class="aw-eff">${parts.join(' ・ ')}</span></div></div>
    ${check.ok ? '' : `<div class="evo-note warn">${check.reason}</div>`}`;

  btn.style.display = 'block';
  btn.disabled = !check.ok;
  btn.textContent = check.ok ? '1体を送還する' : '送還できません';
}

function doDismiss() {
  if (!detailId) return;
  const base = characterById(detailId);
  if (!confirm(`${base.name}を1体送還します。よろしいですか?`)) return;
  const res = dismissCharacter(detailId);
  if (!res.ok) { toast(res.message); return; }
  const names = Object.keys(res.gained)
    .map(k => `${materialById(k).emoji}${res.gained[k]}`).join(' ');
  toast(`送還: ${names} 💰${res.coin.toLocaleString()}`);
  updateStatusBar();
  openDetail(detailId, detailOwned, null, false);
  renderCharacterScreen();
}

function doAwaken(useToken) {
  if (!detailId) return;
  const res = awakenCharacter(detailId, useToken);
  if (!res.ok) { toast(res.message); return; }
  toast(`開眼 ${res.to} 段階目: ${res.step ? res.step.label : ''}`);
  updateStatusBar();
  openDetail(detailId, detailOwned, null, false);
  renderCharacterScreen();
}

function doEvolve() {
  if (!detailId) return;
  const res = evolveCharacter(detailId);
  if (!res.ok) { toast(res.message); return; }
  saveState();
  updateStatusBar();
  showEvolveResult(res.before, res.after);
  openDetail(detailId, detailOwned, null, false);
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

/* ===================== 詳細モーダル ===================== */
function openDetail(id, canEquip, previewStar = null, resetScroll = true) {
  detailId = id;
  detailOwned = canEquip;
  const base = characterById(id);
  const owned = !!entryOf(id);
  const isCatalogPreview = Number.isFinite(previewStar);
  const ch = isCatalogPreview
    ? resolveCharacter(id, previewStar, 1, 0)
    : (owned ? resolveOwned(id) : resolveCharacter(id, null, 1));
  const inTeam = state.team.includes(id);

  const formSwitch = isCatalogPreview ? `
    <div class="segmented small catalog-switch">
      <button data-catalog-star="${base.rarity}" class="${previewStar === base.rarity ? 'active' : ''}">進化前 ★${base.rarity}</button>
      <button data-catalog-star="${finalStarOf(base)}" class="${previewStar === finalStarOf(base) ? 'active' : ''}">進化後 ★${finalStarOf(base)}</button>
    </div>` : '';
  const note = isCatalogPreview
    ? `<div class="cd-note">図鑑プレビューです。育成状況は編成タブの詳細で確認できます。${base.raidDrop?' 入手先：降臨ダンジョン「九狐降臨」（基本50%）。':''}</div>`
    : (owned ? '' : `<div class="cd-note">${ch.raidDrop?'降臨ダンジョン「九狐降臨」でドロップします（基本50%）。':'まだ仲間にしていません。ガチャやショップで探しましょう。'}</div>`);
  $('charDetailBody').innerHTML = formSwitch + charDetailHTML(ch, note);
  $('charDetailBody').querySelectorAll('[data-catalog-star]').forEach(button => {
    button.addEventListener('click', () => openDetail(id, false, Number(button.dataset.catalogStar)));
  });
  const btn = $('charDetailActionBtn');
  btn.style.display = (canEquip && owned && !isCatalogPreview) ? 'block' : 'none';
  btn.textContent = inTeam ? '編成から外す' : '編成に入れる';
  btn.className = 'btn block' + (inTeam ? ' secondary' : '');
  if (owned && !isCatalogPreview) { renderEvolveBox(id); renderAwakenBox(id); renderExpBox(id); renderDismissBox(id); }
  else {
    ['charEvolveBox','charAwakenBox','charExpBox','charDismissBox',
     'charEvolveBtn','charAwakenBtn','charAwakenTokenBtn','charDismissBtn']
      .forEach(k => { $(k).style.display = 'none'; });
  }
  const modal = $('charDetailModal');
  modal.classList.add('show');
  if (resetScroll) modal.querySelector('.modal-card').scrollTop = 0;
}

/* ===================== 編成タブ ===================== */
function renderTeamPane() {
  const team = ownCharacters();
  const slotsEl = $('teamSlots');
  slotsEl.innerHTML = '';

  for (let i = 0; i < TEAM_SIZE; i++) {
    const ch = team[i];
    const div = document.createElement('div');
    div.className = 'teamslot' + (ch ? ' filled' : '');
    if (ch) {
      div.style.setProperty('--aura', COLOR_HEX[AURAS[ch.aura].key]);
      div.innerHTML = `
        <span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        ${portraitHTML(ch)}
        <span class="slot-name">${ch.name}</span>
        <span class="slot-lv">Lv${ch.level}</span>
        <span class="slot-move">
          <button class="mv" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="前へ">▲</button>
          <button class="mv" data-dir="1" ${i === team.length - 1 ? 'disabled' : ''} aria-label="後ろへ">▼</button>
        </span>`;
      div.querySelectorAll('.mv').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          moveInTeam(i, Number(b.dataset.dir));
        });
      });
      div.addEventListener('click', () => openDetail(ch.id, true));
    } else {
      div.innerHTML = `<span class="slot-label">${i === 0 ? 'リーダー' : 'サブ' + i}</span>
        <span class="slot-empty">＋</span><span class="slot-name">空き</span>`;
    }
    slotsEl.appendChild(div);
  }

  const sup = document.createElement('div');
  sup.className = 'teamslot support-slot';
  sup.innerHTML = `<span class="slot-label">サポート</span>
    <span class="slot-empty">🤝</span>
    <span class="slot-name">出発時に選択</span>`;
  slotsEl.appendChild(sup);

  // パーティ概要
  const totalHP = BASE_PARTY_HP + team.reduce((s, m) => s + m.hp, 0);
  const auraSet = [...new Set(team.map(m => m.aura))]
    .map(a => `<span class="aura-chip" style="--aura:${COLOR_HEX[AURAS[a].key]}">${AURAS[a].emoji}${AURAS[a].name}</span>`)
    .join('');
  const ls = team.length ? team[0].leaderSkill : null;
  const extraTime = (ls && ls.time) ? ls.time : 0;
  $('teamSummary').innerHTML = team.length ? `
    <div class="ts-row"><span>合計HP(サポート除く)</span><b>${totalHP}</b></div>
    <div class="ts-row"><span>攻撃できるオーラ</span><b class="aura-chips">${auraSet}</b></div>
    <div class="ts-row"><span>操作時間(自陣LSのみ)</span><b>${((BASE_DRAG_TIME / 1000) + extraTime).toFixed(1)}秒</b></div>`
    : '<div class="empty">キャラクターを編成してください。</div>';

  // リーダースキル
  $('teamLeaderSkill').innerHTML = ls
    ? `<div class="skill-line on"><span class="skill-tag ls">LS</span>
         <span><b>${ls.name}</b><br>${ls.desc}</span></div>
       <div class="mstats mt6">サポート枠のリーダースキルも発動します(ダンジョン出発時に選択)。</div>`
    : '<div class="empty">リーダーが未設定です。</div>';

  renderMaterials();

  // 所持キャラ一覧
  const ownedEl = $('ownedList');
  ownedEl.innerHTML = '';
  const owned = ownedCharacters();
  $('ownedCount').textContent = `${owned.length} / ${CHARACTERS.length} 人`;
  if (!owned.length) {
    ownedEl.innerHTML = '<div class="empty">まだ仲間がいません。ガチャやショップで仲間を増やそう。</div>';
    return;
  }
  owned.forEach(ch => {
    const inTeam = state.team.includes(ch.id);
    const canEvolve = evolveCheck(ch.id).ok;
    const row = document.createElement('div');
    row.className = 'char-row' + (inTeam ? ' in-team' : '');
    row.innerHTML = charRowHTML(ch, ch.count)
      + `<div class="row-actions">
           <button class="btn ${inTeam ? 'secondary' : ''} selbtn">${inTeam ? '外す' : '編成'}</button>
           <button class="btn ghost tiny detailbtn">${canEvolve ? '進化可' : '詳細'}</button>
         </div>`;
    if (canEvolve) row.classList.add('evolvable');
    row.querySelector('.selbtn').addEventListener('click', () => toggleTeam(ch.id));
    row.querySelector('.detailbtn').addEventListener('click', () => openDetail(ch.id, true));
    ownedEl.appendChild(row);
  });
}

/** 所持素材の表示 */
function renderMaterials() {
  const box = $('materialList');
  if (!box) return;
  box.innerHTML = MATERIALS.map(mt => `
    <div class="mt-chip" style="--mt:${mt.color}">
      ${itemIcon(mt.id, 'material')}
      <span class="mt-name">${mt.name}</span>
      <b class="mt-count">${materialCount(mt.id)}</b>
    </div>`).join('');
}

/* ===================== 図鑑タブ ===================== */
function renderListPane() {
  const el = $('allCharacterList');
  el.innerHTML = '';
  CHARACTERS.slice()
    .sort((a, b) => a.aura - b.aura || a.rarity - b.rarity)
    .forEach(base => {
      const e = entryOf(base.id);
      const before = resolveCharacter(base, base.rarity, 1, 0);
      const afterStar = finalStarOf(base);
      const after = resolveCharacter(base, afterStar, 1, 0);
      const aura = AURAS[base.aura];
      const card = document.createElement('div');
      card.className = 'catalog-card' + (e ? '' : ' unowned');
      card.style.setProperty('--aura', COLOR_HEX[aura.key]);
      const form = (ch, label) => `
        <button class="catalog-form" data-star="${ch.star}">
          <span class="catalog-portrait">${artImg(ch.art && ch.art.icon, ch.portrait, 'catalog')}</span>
          <span><b>${label}</b><i>★${ch.star}</i></span>
        </button>`;
      card.innerHTML = `
        <div class="catalog-head">
          <span><b>${base.name}</b><i>${aura.emoji}${aura.name} ・ ${base.job}</i></span>
          <em>${e ? `所持 ★${e.star}` : '未所持'}</em>
        </div>
        <div class="catalog-forms">
          ${form(before, '進化前')}
          <span class="catalog-arrow">›</span>
          ${form(after, '進化後')}
        </div>`;
      card.querySelectorAll('[data-star]').forEach(button => {
        button.addEventListener('click', () => openDetail(base.id, false, Number(button.dataset.star)));
      });
      el.appendChild(card);
    });
}
