/* =========================================================
 * enemies.js — モンスターのマスターデータ
 * アイコン一覧 → タップで詳細/編集。変身(forms)もここで設定する。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, clampInt, modal, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find, putBlob, getBlob } from '../draft.js';
import { toWebp, toIconWebp, previewUrl, humanSize, canEncodeWebp } from '../image.js';
import { effectRow, readEffects, bindEffects, newEffect } from './effects.js';

/** いま編集中の1体。画面を作り直しても保つ */
let editing = null;

/* ===================== 一覧 ===================== */

/** マスターと下書きを合わせた全モンスター */
function allEnemies() {
  const map = new Map();
  G.ENEMY_MASTER_IDS.forEach(id => map.set(id, { ...G.ENEMY_MASTER[id], _source: 'game' }));
  draft().enemies.forEach(e => map.set(e.id, { ...e, _source: 'draft' }));
  return Array.from(map.values());
}

function thumbOf(enemy) {
  // 既存モンスターの名前と絵は enemies.js 側にあるので、
  // マスターを直接見ずに enemyFormOf() で合流させてから使う
  const shape = enemy._source === 'draft'
    ? (enemy.forms ? enemy.forms[0] : enemy)
    : (G.enemyFormOf(enemy.id, 0) || enemy);
  const sprite = shape.sprite || enemy.sprite;
  return sprite
    ? `<img class="thumb" src="../${esc(sprite)}" alt="" loading="lazy"
         onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'emoji',textContent:'👹'}))">`
    : `<div class="emoji">${esc(enemy.emoji || '👹')}</div>`;
}

function cell(enemy) {
  const forms = enemy.forms ? enemy.forms.length : 1;
  const tags = [];
  if (enemy._source === 'draft') tags.push('<span class="tagline new">下書き</span>');
  if (enemy.boss || enemy.forms) tags.push('<span class="tagline">ボス</span>');
  if (forms > 1) tags.push(`<span class="tagline">変身${forms}</span>`);
  const shape = enemy._source === 'draft'
    ? (enemy.forms ? enemy.forms[0] : enemy)
    : (G.enemyFormOf(enemy.id, 0) || enemy);
  return `<button class="icon-cell" data-open="${esc(enemy.id)}">
    ${tags.join('')}${thumbOf(enemy)}
    <span class="cap">${esc(shape.name || enemy.name || enemy.id)}</span>
  </button>`;
}

function renderList(view) {
  const list = allEnemies();
  view.innerHTML = `
    ${card(`モンスター (${list.length})`, `
      <p class="lead">基礎ステータスと行動パターンを持つ「マスターデータ」です。
      降臨の各フロアは、ここの値に倍率をかけて使います。</p>
      <div class="icon-grid">${list.map(cell).join('')}</div>`,
      '<button class="btn primary" id="newEnemy">＋ 新規</button>')}
  `;
  $('newEnemy').addEventListener('click', () => openEditor(view, null));
  view.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => openEditor(view, btn.dataset.open));
  });
}

/* ===================== 編集 ===================== */

/** マスター or 下書きから、編集用の作業コピーを作る */
function loadForEdit(id) {
  if (!id) {
    return {
      id: '', name: '', sprite: '', emoji: '👹',
      hp: 3000, atk: 80, interval: 2,
      effects: [], actions: [], random: false, forms: null, boss: false, _new: true
    };
  }
  const draftHit = find('enemies', id);
  const src = draftHit || (() => {
    // 既存モンスターは名前と絵が enemies.js 側にあるので合流させてから複製する
    const master = G.ENEMY_MASTER[id];
    if (master.forms) return { ...master, name: master.name || G.enemyFormOf(id, 0).name };
    return { ...master, ...G.enemyFormOf(id, 0) };
  })();
  const copy = structuredClone(src);
  // boss 導入前の変身モンスターは、事故防止のためボスとして読み込む
  copy.boss = copy.boss == null ? !!copy.forms : !!copy.boss;
  if (copy.forms) {
    copy.forms = copy.forms.map(f => unpack(f));
  } else {
    Object.assign(copy, unpack(copy));
  }
  copy._new = false;
  return copy;
}

/** enemySkills を編集しやすい形(effects / actions / random)にほどく */
function unpack(shape) {
  const sk = shape.enemySkills || {};
  return {
    ...shape,
    effects: (sk.preemptive && sk.preemptive.effects) || [],
    passives: sk.passives || [],
    actions: sk.actions || [],
    random: !!sk.random,
    buildUpBelow: sk.buildUpBelow == null ? '' : sk.buildUpBelow
  };
}

/** 編集用の形を、ゲームが読む enemySkills に戻す */
function pack(shape) {
  const out = {
    ...(shape.id ? { id: shape.id } : {}),
    name: shape.name, sprite: shape.sprite || undefined, emoji: shape.emoji || '👹',
    hp: shape.hp, atk: shape.atk, interval: shape.interval
  };
  if (shape.intro) out.intro = shape.intro;
  if (shape.dialogue) out.dialogue = shape.dialogue;

  const sk = {};
  if (shape.effects && shape.effects.length) sk.preemptive = { effects: shape.effects };
  if (shape.passives && shape.passives.length) sk.passives = shape.passives;
  if (shape.actions && shape.actions.length) { sk.actions = shape.actions; sk.random = !!shape.random; }
  if (shape.buildUpBelow !== '' && shape.buildUpBelow != null) sk.buildUpBelow = Number(shape.buildUpBelow);
  if (Object.keys(sk).length) out.enemySkills = sk;

  Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k]; });
  return out;
}

/** 保存できる形にまとめる */
function finalize(work) {
  const base = { id: work.id, name: work.name, emoji: work.emoji || '👹', boss: !!work.boss };
  if (work.forms) {
    return { ...base, sprite: work.sprite || undefined, forms: work.forms.map(pack) };
  }
  return { ...base, ...pack(work) };
}

function shapeFields(shape, prefix) {
  return `
    <div class="grid3">
      ${field('HP', `${prefix}hp`, shape.hp, { type: 'number', min: 1, max: 999999 })}
      ${field('攻撃力', `${prefix}atk`, shape.atk, { type: 'number', min: 1, max: 99999 })}
      ${field('攻撃間隔', `${prefix}interval`, shape.interval, { type: 'number', min: 1, max: 10, hint: 'ターン' })}
    </div>`;
}

function openEditor(view, id) {
  editing = loadForEdit(id);
  renderEditor(view);
}

function renderEditor(view) {
  const w = editing;
  const isBoss = !!w.forms;
  const readOnlyId = !w._new;

  const formTabs = isBoss
    ? `<div class="row-btns">
        ${w.forms.map((f, i) => `<button class="btn${i === (w._form || 0) ? ' primary' : ''}"
          data-form="${i}">${i === 0 ? '変身前' : `変身後${i > 1 ? i : ''}`}</button>`).join('')}
        <button class="btn" id="addForm">＋ 姿を足す</button>
        ${w.forms.length > 1 ? '<button class="btn danger" id="dropForm">この姿を消す</button>' : ''}
      </div>`
    : '';

  const shape = isBoss ? w.forms[w._form || 0] : w;

  view.innerHTML = `
    ${card(w._new ? 'モンスターを新規作成' : `${w.name || w.id} を編集`, `
      ${readOnlyId ? '' : '<p class="lead">IDは英数字とアンダースコアだけ。あとから変えられません。</p>'}
      ${field('ID', 'id', w.id, { hint: '例: slime_king', ...(readOnlyId ? {} : {}) })}
      ${field('名前', 'name', w.name)}
      ${field('絵文字', 'emoji', w.emoji || '👹', { hint: '画像が無いときに出る' })}
      ${field('画像パス', 'sprite', (isBoss ? shape.sprite : w.sprite) || '',
        { hint: 'assets/enemy/xxx.webp', placeholder: 'assets/enemy/xxx.webp' })}
      <div id="spriteDrop"></div>

      <h3 style="margin-top:14px">分類</h3>
      <label class="field"><span>
        <input type="checkbox" id="bossFlag"${w.boss ? ' checked' : ''} style="width:auto;margin-right:6px">
        ボスとして扱う</span>
        <small>ノーマル・テクニカル・曜日の自動抽選から除外します。降臨やボスラッシュには明示して配置できます。</small>
      </label>

      <h3 style="margin-top:14px">変身</h3>
      <label class="field"><span>
        <input type="checkbox" id="isBoss"${isBoss ? ' checked' : ''} style="width:auto;margin-right:6px">
        複数の姿（変身）を持つ</span></label>
      ${formTabs}

      <h3 style="margin-top:10px">${isBoss ? `${(w._form || 0) === 0 ? '変身前' : '変身後'}のステータス` : 'ステータス'}</h3>
      ${isBoss ? field('この姿の名前', 'formName', shape.name || '') : ''}
      ${shapeFields(shape, '')}
      ${isBoss ? `
        ${field('登場演出', 'intro', shape.intro || '', {
          type: 'select', options: [['', 'なし'], ['warning', '警告カットイン'], ['evolution', '変身']] })}
        ${field('台詞', 'dialogue', shape.dialogue || '', { type: 'textarea', rows: 2 })}` : ''}

      <h3 style="margin-top:14px">先制(フロアに入った瞬間)</h3>
      <div id="preEffects">${(shape.effects || []).map(effectRow).join('')
        || '<p class="empty">なし</p>'}</div>
      <button class="btn" id="addPre">＋ 先制を足す</button>

      <h3 style="margin-top:14px">毎ターンの行動</h3>
      <p class="lead small">空なら通常攻撃だけ。複数入れると
        ${shape.random ? 'ランダムに' : '順番に'}選ばれます。</p>
      <label class="field"><span>
        <input type="checkbox" id="randomAct"${shape.random ? ' checked' : ''} style="width:auto;margin-right:6px">
        ランダムに選ぶ</span></label>
      <div id="actionList">${(shape.actions || []).map(actionRow).join('') || '<p class="empty">なし</p>'}</div>
      <button class="btn" id="addAction">＋ 行動を足す</button>

      <h3 style="margin-top:14px">ずっと続く性質</h3>
      <div id="passiveEffects">${(shape.passives || []).map(effectRow).join('')
        || '<p class="empty">なし</p>'}</div>
      <button class="btn" id="addPassive">＋ 性質を足す</button>
      ${field('HP%以下でビルドアップ', 'buildUpBelow', shape.buildUpBelow == null ? '' : shape.buildUpBelow,
        { type: 'number', min: 1, max: 100, hint: '空なら無し' })}

      <div class="row-btns" style="margin-top:16px">
        <button class="btn primary" id="saveBtn">下書きに保存</button>
        <button class="btn" id="cancelBtn">やめる</button>
        ${find('enemies', w.id) ? '<button class="btn danger" id="dropBtn">下書きから消す</button>' : ''}
      </div>`)}
  `;

  if (readOnlyId) view.querySelector('[name=id]').readOnly = true;

  /* --- 画像アップロード --- */
  mountSpriteDrop(view, w, isBoss);

  /* --- 姿の切り替え --- */
  view.querySelectorAll('[data-form]').forEach(b => b.addEventListener('click', () => {
    collect(view);
    w._form = Number(b.dataset.form);
    renderEditor(view);
  }));
  const addForm = $('addForm');
  if (addForm) addForm.addEventListener('click', () => {
    collect(view);
    const last = w.forms[w.forms.length - 1];
    w.forms.push({ ...structuredClone(last), name: `${w.name}(変身後)`, intro: 'evolution' });
    w._form = w.forms.length - 1;
    renderEditor(view);
  });
  const dropForm = $('dropForm');
  if (dropForm) dropForm.addEventListener('click', () => {
    collect(view);
    w.forms.splice(w._form || 0, 1);
    w._form = 0;
    renderEditor(view);
  });

  $('isBoss').addEventListener('change', e => {
    collect(view);
    if (e.target.checked && !w.forms) {
      w.boss = true;
      const first = { ...w, name: w.name };
      w.forms = [first, { ...structuredClone(first), name: `${w.name}(変身後)`, intro: 'evolution',
        hp: Math.round((first.hp || 3000) * 1.5), atk: Math.round((first.atk || 80) * 1.2) }];
      w._form = 0;
    } else if (!e.target.checked && w.forms) {
      Object.assign(w, w.forms[0]);
      w.forms = null;
    }
    renderEditor(view);
  });

  /* --- 効果の編集 --- */
  const cur = () => (w.forms ? w.forms[w._form || 0] : w);
  bindEffects($('preEffects'), () => cur().effects || [],
    v => { cur().effects = v; }, () => renderEditor(view), () => collect(view));
  bindEffects($('passiveEffects'), () => cur().passives || [],
    v => { cur().passives = v; }, () => renderEditor(view), () => collect(view));

  $('addPre').addEventListener('click', () => {
    collect(view);
    cur().effects = (cur().effects || []).concat([newEffect()]);
    renderEditor(view);
  });
  $('addPassive').addEventListener('click', () => {
    collect(view);
    cur().passives = (cur().passives || []).concat([newEffect('resolve')]);
    renderEditor(view);
  });
  $('addAction').addEventListener('click', () => {
    collect(view);
    cur().actions = (cur().actions || []).concat([{ attack: true, dialogue: '' }]);
    renderEditor(view);
  });
  $('actionList').addEventListener('click', e => {
    const drop = e.target.closest('[data-drop-action]');
    if (drop) {
      collect(view);
      cur().actions.splice(Number(drop.dataset.dropAction), 1);
      renderEditor(view);
      return;
    }
    const add = e.target.closest('[data-add-act-effect]');
    if (add) {
      collect(view);
      const a = cur().actions[Number(add.dataset.addActEffect)];
      a.effects = (a.effects || []).concat([newEffect('bind')]);
      renderEditor(view);
      return;
    }
    // 行動の中の効果を外す。効果の行は data-effect も持つので先に拾う
    const dropEffect = e.target.closest('[data-drop-effect]');
    if (dropEffect) {
      const box = dropEffect.closest('[data-action]');
      if (!box) return;
      collect(view);
      const a = cur().actions[Number(box.dataset.action)];
      a.effects.splice(Number(dropEffect.dataset.dropEffect), 1);
      if (!a.effects.length) delete a.effects;
      renderEditor(view);
    }
  });
  // 効果の型を変えたら、その型の既定値で作り直す
  $('actionList').addEventListener('change', e => {
    const sel = e.target.closest('[data-type]');
    if (!sel) return;
    const box = sel.closest('[data-action]');
    const row = sel.closest('[data-effect]');
    if (!box || !row) return;
    collect(view);
    const a = cur().actions[Number(box.dataset.action)];
    a.effects[Number(row.dataset.effect)] = newEffect(sel.value);
    renderEditor(view);
  });

  /* --- 保存 --- */
  $('saveBtn').addEventListener('click', () => {
    collect(view);
    if (!/^[a-z0-9_]+$/i.test(w.id)) { toast('IDは英数字とアンダースコアだけにしてください', 'ng'); return; }
    if (!w.name) { toast('名前を入れてください', 'ng'); return; }
    upsert('enemies', finalize(w));
    toast('下書きに保存しました', 'ok');
    editing = null;
    renderList(view);
  });
  $('cancelBtn').addEventListener('click', () => { editing = null; renderList(view); });
  const dropBtn = $('dropBtn');
  if (dropBtn) dropBtn.addEventListener('click', async () => {
    if (!await confirmAsk('下書きから消す', `${w.name} の編集内容を捨てますか？`, '消す')) return;
    remove('enemies', w.id);
    editing = null;
    renderList(view);
  });
}

/**
 * 行動1つぶんの編集行。
 * 「攻撃」と「特殊行動」は排他ではない。両方入れると、殴りながら
 * 効果も撃つ(キュウコの進化後が元からこの形)。
 */
function actionRow(action, index) {
  const effects = action.effects || [];
  return `<div class="slot slot-stack" data-action="${index}">
    <div class="slot-line">
      <label class="small" style="flex:0 0 auto">
        <input type="checkbox" data-act-attack${action.attack ? ' checked' : ''}>攻撃する</label>
      <span class="grow small" style="color:var(--ink-faint)">
        ${effects.length ? `＋ 特殊行動 ${effects.length} 個` : '特殊行動なし'}</span>
      <button class="icon-btn" data-drop-action="${index}" aria-label="削除"
        style="width:28px;height:28px;flex:0 0 28px;font-size:13px">✕</button>
    </div>
    <div class="slot-line">
      <input class="grow mini" style="text-align:left" data-act-dialogue
        placeholder="台詞(任意)" value="${esc(action.dialogue || '')}">
    </div>
    <div data-act-effects="${index}">${effects.map((ef, i) =>
      effectRow(ef, i).replace('data-effect="', `data-act-effect="${index}" data-effect="`)).join('')}</div>
    <div class="slot-line">
      <button class="btn" data-add-act-effect="${index}" style="padding:4px 9px">＋ 特殊行動を足す</button>
    </div>
  </div>`;
}

/** 画面の入力を作業コピーへ書き戻す */
function collect(view) {
  const w = editing;
  const v = readForm(view.querySelector('.card'));
  w.id = String(v.id || '').trim();
  w.name = String(v.name || '').trim();
  w.emoji = String(v.emoji || '👹').trim();
  w.boss = !!$('bossFlag')?.checked;

  const target = w.forms ? w.forms[w._form || 0] : w;
  if (w.forms) {
    if (v.formName != null) target.name = String(v.formName).trim() || w.name;
    target.sprite = String(v.sprite || '').trim() || undefined;
    target.intro = v.intro || undefined;
    target.dialogue = String(v.dialogue || '').trim() || undefined;
  } else {
    w.sprite = String(v.sprite || '').trim() || undefined;
  }
  target.hp = clampInt(v.hp, 1, 999999, target.hp || 3000);
  target.atk = clampInt(v.atk, 1, 99999, target.atk || 80);
  target.interval = clampInt(v.interval, 1, 10, target.interval || 2);
  target.buildUpBelow = v.buildUpBelow == null || v.buildUpBelow === '' ? '' : v.buildUpBelow;

  const pre = $('preEffects');
  if (pre) target.effects = readEffects(pre);
  const pas = $('passiveEffects');
  if (pas) target.passives = readEffects(pas);

  const randomBox = $('randomAct');
  if (randomBox) target.random = randomBox.checked;
  const actions = $('actionList');
  if (actions) {
    target.actions = Array.from(actions.querySelectorAll('[data-action]')).map(box => {
      const out = {};
      if (box.querySelector('[data-act-attack]').checked) out.attack = true;
      const line = box.querySelector('[data-act-dialogue]').value.trim();
      if (line) out.dialogue = line;
      const host = box.querySelector('[data-act-effects]');
      const effects = host ? readEffects(host) : [];
      if (effects.length) out.effects = effects;
      return out;
    });
  }
}

/** 画像アップロード欄 */
function mountSpriteDrop(view, w, isBoss) {
  const host = $('spriteDrop');
  const target = isBoss ? w.forms[w._form || 0] : w;
  const path = target.sprite || '';
  const held = path ? getBlob(path) : null;

  host.innerHTML = `
    <label class="drop">
      画像を選ぶ(PNG/JPEG/WebP)<br>
      <span class="small">ツール内で webp にしてから push します</span>
      <input type="file" accept="image/*" id="spriteFile">
    </label>
    <div class="shots" id="spriteShots">${held
      ? `<div class="shot"><img src="${previewUrl(held)}" alt="">
         <span class="cap">${esc(path)}<br>${humanSize(held.size)}</span></div>`
      : ''}</div>`;

  $('spriteFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!canEncodeWebp()) { toast('この端末は webp を書き出せません', 'ng'); return; }
    collect(view);
    const id = w.id || 'new';
    const dest = (isBoss ? w.forms[w._form || 0].sprite : w.sprite)
      || `assets/enemy/${id}.webp`;
    try {
      const blob = await toWebp(file, 768, 0.9);
      putBlob(dest, blob);
      if (isBoss) w.forms[w._form || 0].sprite = dest; else w.sprite = dest;
      toast(`webp にしました (${humanSize(blob.size)})`, 'ok');
      renderEditor(view);
    } catch (err) {
      toast(String(err.message || err), 'ng');
    }
  });
}

export default {
  render(view) {
    if (editing) renderEditor(view); else renderList(view);
  }
};
