/* =========================================================
 * raids.js — 降臨ダンジョンの編集
 * フロアごとに出すモンスターを並べ、マスターの基礎値に倍率をかける。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, clampInt, modal, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find, putBlob, getBlob } from '../draft.js';
import { toWebp, toBannerWebp, previewUrl, humanSize, canEncodeWebp } from '../image.js';
import { mergeCatalog } from '../draft-catalog.js';
import { publicationFields, readPublication, validPublication } from '../publication.js';

let editing = null;
const enemyIds = () => [...new Set([...G.ENEMY_MASTER_IDS, ...draft().enemies.map(e => e.id)])];
const enemyMaster = id => find('enemies', id) || G.enemyMasterById(id);
const isBossMaster = master => !!(master && (master.boss || master.forms));
function enemyShape(id, form = 0) {
  const pending = find('enemies', id);
  return pending ? (pending.forms ? pending.forms[form] : pending) : G.enemyFormOf(id, form);
}

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
  return { id: masterId, form, mult: same ? round3(hp) : { hp: round3(hp), atk: round3(atk) },
    ...(enemy.sprite && enemy.sprite !== base.sprite ? { sprite: enemy.sprite } : {}) };
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
  const master = enemyMaster(spec.id);
  const forms = master?.forms?.length || 1;
  const shape = master ? enemyShape(spec.id, spec.form || 0) : null;
  const m = multValue(spec.mult);
  const hp = shape ? Math.round(shape.hp * m.hp) : 0;
  const atk = shape ? Math.round(shape.atk * m.atk) : 0;

  const opts = enemyIds().map(id => {
    const s = enemyShape(id, 0);
    const mark = isBossMaster(enemyMaster(id)) ? '【ボス】' : '';
    return `<option value="${esc(id)}"${id === spec.id ? ' selected' : ''}>${mark}${esc(s.name)}</option>`;
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
    <label class="small">この出現枠だけの画像（空欄なら通常の姿）
      <input data-slot-sprite value="${esc(spec.sprite || '')}" placeholder="assets/enemy/xxx.webp"></label>
    <label class="drop">画像をWebPに変換<input data-slot-file type="file" accept="image/*"></label>
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
  const charOpts = [['', '（なし）']].concat(mergeCatalog(G.CHARACTERS, draft().characters).map(c => [c.id, `${c.name}(★${c.rarity})`]));

  view.innerHTML = `
    ${card(r._new ? '降臨を新規作成' : `${r.name} を編集`, `
      <p class="lead small">ボスを含むすべてのモンスターを明示配置できます。ボスは選択肢に「【ボス】」と表示され、通常ダンジョンの自動抽選には入りません。</p>
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
      </div>

      ${field('掲載場所', 'category', r.category || 'raid', {type:'select',options:[['raid','降臨ダンジョン'],['event','イベント']]})}
      ${publicationFields(r)}
      ${field('バトル背景画像パス', 'battleBackground', r.battleBackground || '', {placeholder:'assets/ui/xxx.webp'})}
      <label class="drop">バトル背景をWebPに変換<input type="file" id="battleBgFile" accept="image/*"></label>
      <div class="shots" id="battleBgShot"></div>
      ${field('交換素材ID（空で通常ドロップ）', 'currencyId', r.currencyDrop?.id || '')}
      ${field('クリア時の確定ドロップ数', 'currencyAmount', r.currencyDrop?.amount || 0, {type:'number',min:0,max:9999})}
      <h3 style="margin-top:12px">ホームのバナー</h3>
      <p class="lead small">ホームに出す宣伝バナーです。
        <b>降臨のバナーは常に1枚</b>で、新しい降臨を足すと今までのものと入れ替わります
        (ガチャのバナーとは数秒ごとに交互に出ます)。</p>
      ${field('バナー画像のパス', 'banner', r.banner || '',
        { hint: 'assets/promo/xxx.webp', placeholder: 'assets/promo/xxx.webp' })}
      <label class="drop">バナー画像を選ぶ(1080×400 に整えます)
        <input type="file" accept="image/*" id="raidBannerFile"></label>
      <div class="shots" id="raidBannerShot"></div>`)}

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

  floors.addEventListener('change', async e => {
    if (e.target.matches('[data-slot-file]')) {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!canEncodeWebp()) { toast('この端末はWebPを書き出せません', 'ng'); return; }
      const [fi, si] = e.target.closest('[data-slot]').dataset.slot.split('-').map(Number);
      collect(view);
      const spec = r.floors[fi].enemies[si];
      const dest = spec.sprite || `assets/enemy/raid_${r.id}_floor_${fi + 1}_${si + 1}.webp`;
      if (!/^assets\/[a-zA-Z0-9_/-]+\.webp$/.test(dest)) { toast('保存先はassets/以下のWebPパスにしてください', 'ng'); return; }
      try {
        const blob = await toWebp(file, 768, 0.9);
        putBlob(dest, blob);
        spec.sprite = dest;
        toast(`WebPにしました (${humanSize(blob.size)})`, 'ok');
        renderEditor(view);
      } catch (err) { toast(String(err.message || err), 'ng'); }
      return;
    }
    const slot = e.target.closest('[data-slot]');
    if (slot) {
      collect(view);
      renderEditor(view);
      return;
    }
    if (e.target.name && e.target.name.startsWith('intro-')) collect(view);
  });

  $('battleBgFile').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canEncodeWebp()) { toast('この端末はWebPを書き出せません', 'ng'); return; }
    collect(view);
    const dest = r.battleBackground || `assets/ui/raid_${r.id}_battle.webp`;
    if (!/^assets\/[a-zA-Z0-9_/-]+\.webp$/.test(dest)) { toast('保存先はassets/以下のWebPパスにしてください', 'ng'); return; }
    try {
      const blob = await toWebp(file, 1600, 0.86);
      putBlob(dest, blob);
      r.battleBackground = dest;
      toast(`WebPにしました (${humanSize(blob.size)})`, 'ok');
      renderEditor(view);
    } catch (err) { toast(String(err.message || err), 'ng'); }
  });
  const bgPath = r.battleBackground;
  const bgBlob = bgPath && getBlob(bgPath);
  $('battleBgShot').innerHTML = bgBlob
    ? `<div class="shot wide" style="width:100%"><img src="${previewUrl(bgBlob)}" alt=""><span class="cap">${esc(bgPath)} / ${humanSize(bgBlob.size)}</span></div>`
    : (bgPath ? `<p class="empty">${esc(bgPath)} を使う設定です</p>` : '');
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

  /* --- バナー --- */
  const shot = () => {
    const path = r.banner;
    const held = path ? getBlob(path) : null;
    $('raidBannerShot').innerHTML = held
      ? `<div class="shot wide" style="width:100%"><img src="${previewUrl(held)}" alt="">
         <span class="cap">${esc(path)} / ${humanSize(held.size)}</span></div>`
      : (path ? `<p class="empty">${esc(path)} を使う設定です(画像は未アップロード)</p>` : '');
  };
  shot();
  $('raidBannerFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!canEncodeWebp()) { toast('この端末は webp を書き出せません', 'ng'); return; }
    collect(view);
    // パスを決めていなければ、降臨IDから作る
    const dest = r.banner || `assets/promo/raid_${r.id}_banner.webp`;
    try {
      const blob = await toBannerWebp(file);
      putBlob(dest, blob);
      r.banner = dest;
      toast(`webp にしました (${humanSize(blob.size)})`, 'ok');
      renderEditor(view);
    } catch (err) { toast(String(err.message || err), 'ng'); }
  });

  $('addFloor').addEventListener('click', () => {
    collect(view);
    r.floors.push({ enemies: [{ id: G.ENEMY_MASTER_IDS[0], form: 0, mult: 1 }] });
    renderEditor(view);
  });

  $('saveBtn').addEventListener('click', () => {
    collect(view);
    if (!r.name) { toast('名前を入れてください', 'ng'); return; }
    if (!validPublication(r)) { toast('公開期間を確認してください', 'ng'); return; }
    const empty = r.floors.findIndex(f => !f.enemies.length);
    if (empty >= 0) { toast(`${empty + 1}フロアにモンスターがいません`, 'ng'); return; }
    const out = {
      id: Number(r.id), name: r.name, bgm: r.bgm, stamina: r.stamina,
      category:r.category, eventId:r.eventId, enabled:r.enabled,
      availableFrom:r.availableFrom, availableUntil:r.availableUntil, currencyDrop:r.currencyDrop,
      ...(r.banner ? { banner: r.banner } : {}),
      ...(r.battleBackground ? { battleBackground: r.battleBackground } : {}),
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
  Object.assign(r, readPublication(v));
  r.category = v.category || 'raid';
  r.currencyDrop = v.currencyId ? {id:String(v.currencyId).trim(),amount:clampInt(v.currencyAmount,1,9999,1)} : null;
  r.id = clampInt(v.id, 1, 999999, r.id);
  r.name = String(v.name || '').trim();
  r.bgm = String(v.bgm || '').trim();
  r.banner = String(v.banner || '').trim() || undefined;
  r.battleBackground = String(v.battleBackground || '').trim() || undefined;
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
      const sprite = slot.querySelector('[data-slot-sprite]').value.trim();
      if (sprite) spec.sprite = sprite;
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
