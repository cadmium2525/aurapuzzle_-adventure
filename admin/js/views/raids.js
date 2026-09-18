/* =========================================================
 * raids.js — 降臨ダンジョンの編集
 * フロアごとに出すモンスターを並べ、マスターの基礎値に倍率をかける。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, clampInt, modal, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find } from '../draft.js';

let editing = null;

/* ===================== 一覧 ===================== */

function allRaids() {
  const map = new Map();
  G.RAID_STAGES.forEach(r => map.set(String(r.id), { raw: r, source: 'game' }));
  draft().raids.forEach(r => map.set(String(r.id), { raw: r, source: 'draft' }));
  return Array.from(map.values());
}

/** 既存の降臨(組み立て済み)を編集できる形に戻す */
function toEditable(stage) {
  if (stage.floors && stage.floors[0] && stage.floors[0].enemies
      && stage.floors[0].enemies[0] && stage.floors[0].enemies[0].hp != null
      && !stage.floors[0].enemies[0].id0) {
    // ゲーム本体の降臨は組み立て済みなので、マスターと突き合わせて倍率に戻す
    return {
      ...stage,
      floors: stage.floors.map(f => ({
        intro: f.intro, dialogue: f.dialogue,
        enemies: (f.enemies || []).map(e => backToSpec(e))
      }))
    };
  }
  return structuredClone(stage);
}

/** 組み立て済みの1体から {id, form, mult} を推測する */
function backToSpec(enemy) {
  const masterId = G.ENEMY_MASTER_IDS.find(id => {
    const count = G.formCountOf(id);
    for (let f = 0; f < count; f++) {
      if (G.enemyFormOf(id, f).id === enemy.id) return true;
    }
    return false;
  });
  if (!masterId) return { id: enemy.id, form: 0, mult: 1 };
  const count = G.formCountOf(masterId);
  let form = 0;
  for (let f = 0; f < count; f++) if (G.enemyFormOf(masterId, f).id === enemy.id) form = f;
  const base = G.enemyFormOf(masterId, form);
  const hp = base.hp ? enemy.hp / base.hp : 1;
  const atk = base.atk ? enemy.atk / base.atk : 1;
  const same = Math.abs(hp - atk) < 0.001;
  return { id: masterId, form, mult: same ? round3(hp) : { hp: round3(hp), atk: round3(atk) } };
}
const round3 = n => Math.round(n * 1000) / 1000;

function renderList(view) {
  const list = allRaids();
  view.innerHTML = `
    ${card(`降臨ダンジョン (${list.length})`, `
      <p class="lead">フロアごとにモンスターを置き、マスターの基礎ステータスに倍率をかけます。</p>
      <div class="rows">
        ${list.map(({ raw, source }) => `<button class="row" data-open="${esc(raw.id)}">
          <div class="grow"><b>${esc(raw.name)}${source === 'draft' ? ' <span class="tagline new">下書き</span>' : ''}</b>
            <span class="sub">ID ${esc(raw.id)} ・ ${(raw.floors || []).length}フロア ・
              スタミナ${esc(raw.stamina ?? 30)}</span></div>
          <span class="tail">›</span></button>`).join('')}
      </div>`,
      '<button class="btn primary" id="newRaid">＋ 新規</button>')}
  `;
  $('newRaid').addEventListener('click', () => {
    const used = new Set(allRaids().map(r => Number(r.raw.id)));
    let id = 2002;
    while (used.has(id)) id += 1;
    editing = {
      id, name: '新しい降臨', bgm: 'kyuko', stamina: 30,
      coinReward: 9000, expReward: 180, charExpReward: 600,
      shardRate: 0.35, crystalBase: 8, dropAura: 4,
      characterDrop: { id: '', rate: 0.5 },
      floors: [{ enemies: [{ id: G.ENEMY_MASTER_IDS[0], form: 0, mult: 1 }] }],
      _new: true
    };
    renderEditor(view);
  });
  view.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
    const hit = list.find(r => String(r.raw.id) === b.dataset.open);
    editing = toEditable(hit.raw);
    editing._new = false;
    renderEditor(view);
  }));
}

/* ===================== 編集 ===================== */

function multValue(mult) {
  if (mult == null) return { hp: 1, atk: 1, linked: true };
  if (typeof mult === 'number') return { hp: mult, atk: mult, linked: true };
  return { hp: mult.hp ?? 1, atk: mult.atk ?? 1, linked: false };
}

function slotRow(spec, fi, si) {
  const master = G.enemyMasterById(spec.id);
  const forms = master ? G.formCountOf(spec.id) : 1;
  const shape = master ? G.enemyFormOf(spec.id, spec.form || 0) : null;
  const m = multValue(spec.mult);
  const hp = shape ? Math.round(shape.hp * m.hp) : 0;
  const atk = shape ? Math.round(shape.atk * m.atk) : 0;

  const opts = G.ENEMY_MASTER_IDS.map(id => {
    const s = G.enemyFormOf(id, 0);
    return `<option value="${esc(id)}"${id === spec.id ? ' selected' : ''}>${esc(s.name)}</option>`;
  }).join('');

  const formSel = forms > 1
    ? `<select data-slot-form style="flex:0 0 auto;width:auto;padding:4px;border-radius:7px;
        border:1px solid var(--line);background:#0b0a14;color:var(--ink);font-size:11px">
        ${Array.from({ length: forms }, (_, i) =>
          `<option value="${i}"${(spec.form || 0) === i ? ' selected' : ''}>${i === 0 ? '変身前' : `変身後${i > 1 ? i : ''}`}</option>`).join('')}
      </select>`
    : '';

  // 名前は必ず読めるように1行目を丸ごと使い、倍率は2行目に置く
  return `<div class="slot slot-stack" data-slot="${fi}-${si}">
    <div class="slot-line">
      <select data-slot-id class="grow">${opts}</select>
      ${formSel}
      <button class="icon-btn" data-drop-slot="${fi}-${si}" aria-label="削除"
        style="width:28px;height:28px;flex:0 0 28px;font-size:13px">✕</button>
    </div>
    <div class="slot-line">
      <label class="small">HP×
        <input class="mini" type="number" step="0.05" min="0.05" max="50" data-slot-hp value="${m.hp}"></label>
      <label class="small">攻×
        <input class="mini" type="number" step="0.05" min="0.05" max="50" data-slot-atk value="${m.atk}"></label>
      <span class="grow tail mono" style="text-align:right">${hp.toLocaleString()} / ${atk.toLocaleString()}</span>
    </div>
  </div>`;
}

function floorBox(floor, fi, total) {
  return `<div class="floor" data-floor="${fi}">
    <div class="floor-head">
      <b>${fi + 1} / ${total} フロア</b>
      <button class="btn" data-add-slot="${fi}" style="padding:4px 9px">＋体</button>
      <button class="icon-btn" data-up="${fi}" aria-label="上へ"
        style="width:28px;height:28px;font-size:13px">↑</button>
      <button class="icon-btn" data-drop-floor="${fi}" aria-label="削除"
        style="width:28px;height:28px;font-size:13px">✕</button>
    </div>
    ${(floor.enemies || []).map((s, si) => slotRow(s, fi, si)).join('')}
    <div class="grid2" style="margin-top:6px">
      ${field('登場演出', `intro-${fi}`, floor.intro || '', {
        type: 'select', options: [['', 'なし'], ['warning', '警告'], ['evolution', '変身']] })}
      ${field('台詞', `dialogue-${fi}`, floor.dialogue || '')}
    </div>
  </div>`;
}

function renderEditor(view) {
  const r = editing;
  const charOpts = [['', '（なし）']].concat(G.CHARACTERS.map(c => [c.id, `${c.name}(★${c.rarity})`]));

  view.innerHTML = `
    ${card(r._new ? '降臨を新規作成' : `${r.name} を編集`, `
      <div class="grid2">
        ${field('ID', 'id', r.id, { type: 'number', hint: '2001〜。他とかぶらない番号' })}
        ${field('名前', 'name', r.name)}
      </div>
      <div class="grid3">
        ${field('スタミナ', 'stamina', r.stamina ?? 30, { type: 'number', min: 1, max: 99 })}
        ${field('コイン', 'coinReward', r.coinReward ?? 9000, { type: 'number', min: 0 })}
        ${field('EXP', 'expReward', r.expReward ?? 180, { type: 'number', min: 0 })}
      </div>
      <div class="grid3">
        ${field('キャラEXP', 'charExpReward', r.charExpReward ?? 600, { type: 'number', min: 0 })}
        ${field('結晶の基礎数', 'crystalBase', r.crystalBase ?? 8, { type: 'number', min: 0, max: 99 })}
        ${field('輝石の率', 'shardRate', r.shardRate ?? 0.35, { type: 'number', min: 0, max: 1, step: 0.05 })}
      </div>
      <div class="grid2">
        ${field('落ちる結晶', 'dropAura', r.dropAura ?? 4, {
          type: 'select', options: G.AURA_NAME.map((n, i) => [i, n]) })}
        ${field('BGM', 'bgm', r.bgm || 'kyuko', { hint: 'assets/bgm/ のファイル名' })}
      </div>
      <div class="grid2">
        ${field('ドロップするキャラ', 'dropChar', (r.characterDrop || {}).id || '',
          { type: 'select', options: charOpts })}
        ${field('ドロップ率', 'dropRate', (r.characterDrop || {}).rate ?? 0.5,
          { type: 'number', min: 0, max: 1, step: 0.05 })}
      </div>`)}

    ${card(`フロア (${r.floors.length})`, `
      <p class="lead">右の数字は「倍率をかけたあとのHP / 攻撃力」です。</p>
      <div id="floors">${r.floors.map((f, i) => floorBox(f, i, r.floors.length)).join('')}</div>
      <button class="btn wide" id="addFloor">＋ フロアを足す</button>`)}

    <div class="row-btns">
      <button class="btn primary" id="saveBtn">下書きに保存</button>
      <button class="btn" id="cancelBtn">やめる</button>
      ${find('raids', r.id) ? '<button class="btn danger" id="dropBtn">下書きから消す</button>' : ''}
    </div>
  `;

  const floors = $('floors');

  floors.addEventListener('change', e => {
    const slot = e.target.closest('[data-slot]');
    if (slot) {
      collect(view);
      renderEditor(view);
      return;
    }
    if (e.target.name && e.target.name.startsWith('intro-')) collect(view);
  });
  floors.addEventListener('input', e => {
    if (e.target.matches('[data-slot-hp],[data-slot-atk]')) { collect(view); renderEditor(view); }
  });
  floors.addEventListener('click', e => {
    const add = e.target.closest('[data-add-slot]');
    const dropSlot = e.target.closest('[data-drop-slot]');
    const dropFloor = e.target.closest('[data-drop-floor]');
    const up = e.target.closest('[data-up]');
    if (!add && !dropSlot && !dropFloor && !up) return;
    collect(view);
    if (add) {
      r.floors[Number(add.dataset.addSlot)].enemies.push({ id: G.ENEMY_MASTER_IDS[0], form: 0, mult: 1 });
    } else if (dropSlot) {
      const [fi, si] = dropSlot.dataset.dropSlot.split('-').map(Number);
      r.floors[fi].enemies.splice(si, 1);
    } else if (dropFloor) {
      r.floors.splice(Number(dropFloor.dataset.dropFloor), 1);
    } else if (up) {
      const i = Number(up.dataset.up);
      if (i > 0) { const [f] = r.floors.splice(i, 1); r.floors.splice(i - 1, 0, f); }
    }
    if (!r.floors.length) r.floors.push({ enemies: [] });
    renderEditor(view);
  });

  $('addFloor').addEventListener('click', () => {
    collect(view);
    r.floors.push({ enemies: [{ id: G.ENEMY_MASTER_IDS[0], form: 0, mult: 1 }] });
    renderEditor(view);
  });

  $('saveBtn').addEventListener('click', () => {
    collect(view);
    if (!r.name) { toast('名前を入れてください', 'ng'); return; }
    const empty = r.floors.findIndex(f => !f.enemies.length);
    if (empty >= 0) { toast(`${empty + 1}フロアにモンスターがいません`, 'ng'); return; }
    const out = {
      id: Number(r.id), name: r.name, bgm: r.bgm, stamina: r.stamina,
      coinReward: r.coinReward, orbReward: 0, expReward: r.expReward,
      charExpReward: r.charExpReward, auras: [0, 1, 2, 3, 4],
      dropAura: r.dropAura, shardRate: r.shardRate, crystalBase: r.crystalBase,
      floors: r.floors.map(f => Object.assign(
        { enemies: f.enemies },
        f.intro ? { intro: f.intro } : {},
        f.dialogue ? { dialogue: f.dialogue } : {}
      ))
    };
    if (r.characterDrop && r.characterDrop.id) out.characterDrop = r.characterDrop;
    upsert('raids', out);
    toast('下書きに保存しました', 'ok');
    editing = null;
    renderList(view);
  });
  $('cancelBtn').addEventListener('click', () => { editing = null; renderList(view); });
  const dropBtn = $('dropBtn');
  if (dropBtn) dropBtn.addEventListener('click', async () => {
    if (!await confirmAsk('下書きから消す', `${r.name} の編集内容を捨てますか？`, '消す')) return;
    remove('raids', r.id);
    editing = null;
    renderList(view);
  });
}

function collect(view) {
  const r = editing;
  const head = view.querySelector('.card');
  const v = readForm(head);
  r.id = clampInt(v.id, 1, 999999, r.id);
  r.name = String(v.name || '').trim();
  r.bgm = String(v.bgm || '').trim();
  r.stamina = clampInt(v.stamina, 1, 99, r.stamina);
  r.coinReward = clampInt(v.coinReward, 0, 9999999, r.coinReward);
  r.expReward = clampInt(v.expReward, 0, 999999, r.expReward);
  r.charExpReward = clampInt(v.charExpReward, 0, 999999, r.charExpReward);
  r.crystalBase = clampInt(v.crystalBase, 0, 99, r.crystalBase);
  r.shardRate = Math.max(0, Math.min(1, Number(v.shardRate) || 0));
  r.dropAura = clampInt(v.dropAura, 0, 4, r.dropAura);
  r.characterDrop = v.dropChar
    ? { id: v.dropChar, rate: Math.max(0, Math.min(1, Number(v.dropRate) || 0)) }
    : null;

  const floors = $('floors');
  if (!floors) return;
  Array.from(floors.querySelectorAll('[data-floor]')).forEach((box, fi) => {
    const floor = r.floors[fi];
    if (!floor) return;
    floor.enemies = Array.from(box.querySelectorAll('[data-slot]')).map(slot => {
      const id = slot.querySelector('[data-slot-id]').value;
      const formSel = slot.querySelector('[data-slot-form]');
      const hp = Number(slot.querySelector('[data-slot-hp]').value) || 1;
      const atk = Number(slot.querySelector('[data-slot-atk]').value) || 1;
      const spec = { id, form: formSel ? Number(formSel.value) : 0 };
      spec.mult = Math.abs(hp - atk) < 0.0001 ? hp : { hp, atk };
      return spec;
    });
    const intro = box.querySelector(`[name="intro-${fi}"]`);
    const dialogue = box.querySelector(`[name="dialogue-${fi}"]`);
    floor.intro = intro ? (intro.value || undefined) : floor.intro;
    floor.dialogue = dialogue ? (dialogue.value.trim() || undefined) : floor.dialogue;
  });
}

export default {
  render(view) {
    if (editing) renderEditor(view); else renderList(view);
  }
};
