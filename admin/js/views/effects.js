/* =========================================================
 * effects.js — 特殊行動(効果)の編集パーツ
 * モンスター編集とボスの姿の編集で同じものを使う。
 * =======================================================*/
import { esc } from '../ui.js';
import * as G from '../gamedata.js';

/** 効果1つぶんの編集行 */
export function effectRow(effect, index) {
  const def = G.ENEMY_EFFECT_BY_TYPE[effect.type] || G.ENEMY_EFFECTS[0];
  const typeOpts = G.ENEMY_EFFECTS
    .map(e => `<option value="${e.type}"${e.type === effect.type ? ' selected' : ''}>${esc(e.label)}</option>`)
    .join('');

  const args = def.args.map(a => {
    const value = effect[a.key];
    if (a.aura) {
      const opts = G.AURA_NAME
        .map((n, i) => `<option value="${i}"${Number(value) === i ? ' selected' : ''}>${esc(n)}</option>`)
        .join('');
      return `<label class="small">${esc(a.label)}
        <select class="mini" data-arg="${a.key}" style="width:auto">${opts}</select></label>`;
    }
    if (a.options) {
      const opts = a.options
        .map(o => `<option value="${esc(o)}"${String(value) === String(o) ? ' selected' : ''}>${esc(o)}</option>`)
        .join('');
      return `<label class="small">${esc(a.label)}
        <select class="mini" data-arg="${a.key}" style="width:auto">${opts}</select></label>`;
    }
    return `<label class="small">${esc(a.label)}
      <input class="mini" type="number" data-arg="${a.key}"
        min="${a.min}" max="${a.max}" value="${value == null ? '' : esc(value)}"></label>`;
  }).join('');

  return `<div class="slot" data-effect="${index}">
    <select data-type style="flex:0 0 auto;width:auto;padding:4px 6px;border-radius:7px;
      border:1px solid var(--line);background:#0b0a14;color:var(--ink);font-size:11.5px">${typeOpts}</select>
    <div class="grow" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${args}</div>
    <button class="icon-btn" data-drop-effect="${index}" aria-label="削除"
      style="width:28px;height:28px;flex:0 0 28px;font-size:13px">✕</button>
  </div>`;
}

/** 編集行の並びを読み取って効果の配列に戻す */
export function readEffects(root) {
  return Array.from(root.querySelectorAll('[data-effect]')).map(box => {
    const type = box.querySelector('[data-type]').value;
    const def = G.ENEMY_EFFECT_BY_TYPE[type];
    const effect = { type };
    box.querySelectorAll('[data-arg]').forEach(input => {
      const key = input.dataset.arg;
      const arg = def && def.args.find(a => a.key === key);
      if (!arg) return;
      const raw = input.value;
      if (raw === '') return;                 // 空は「指定なし」。turns を空にするとずっと続く
      effect[key] = arg.options ? raw : Number(raw);
    });
    return effect;
  });
}

/**
 * 効果リストを編集できるようにする。
 * 型を変えたら引数欄も作り直す(型ごとに必要な引数が違うため)。
 */
export function bindEffects(container, getList, setList, rerender) {
  container.addEventListener('change', e => {
    const sel = e.target.closest('[data-type]');
    if (!sel) return;
    const box = sel.closest('[data-effect]');
    const i = Number(box.dataset.effect);
    const list = getList();
    const def = G.ENEMY_EFFECT_BY_TYPE[sel.value];
    // 型が変わったら、その型の既定値で作り直す
    const next = { type: sel.value };
    (def ? def.args : []).forEach(a => { if (a.def != null) next[a.key] = a.def; });
    list[i] = next;
    setList(list);
    rerender();
  });
  container.addEventListener('click', e => {
    const drop = e.target.closest('[data-drop-effect]');
    if (!drop) return;
    const list = getList();
    list.splice(Number(drop.dataset.dropEffect), 1);
    setList(list);
    rerender();
  });
  container.addEventListener('input', e => {
    if (!e.target.matches('[data-arg]')) return;
    setList(readEffects(container));
  });
}

/** 新しい効果の既定値 */
export function newEffect(type = 'comboGuard') {
  const def = G.ENEMY_EFFECT_BY_TYPE[type] || G.ENEMY_EFFECTS[0];
  const effect = { type: def.type };
  def.args.forEach(a => { if (a.def != null) effect[a.key] = a.def; });
  return effect;
}
