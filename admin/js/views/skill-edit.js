/* =========================================================
 * skill-edit.js — スキルをパーツから組み立てる
 *
 * まったく新しい「効果の種類」はここでは作れない。それには
 * battle/ 側の実装が要るため。ここでできるのは
 *   ・既存スキルを分解して、どのパーツでできているかを見る
 *   ・パーツを足し引きして、倍率やターン数を変える
 *   ・名前を付けて新しいスキルとして登録する
 * で、実際のスキルはほぼ全部この組み合わせでできている。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find } from '../draft.js';
import {
  partsFor, decompose, compose, defaultsOf, AURA_LABEL, AURA_KEYS
} from '../skill-parts.js';

/** 編集中のスキル。null なら一覧に戻る */
let editing = null;

/** kind ごとの呼び名と保存先 */
const KIND = {
  leader: { label: 'リーダースキル', bucket: 'leaderSkills', prefix: 'ls_' },
  active: { label: 'スキル', bucket: 'skills', prefix: 'sk_' }
};

/** ゲーム本体 + 下書き の全スキル */
export function allSkills(kind) {
  const base = kind === 'leader' ? G.LEADER_SKILLS : G.ACTIVE_SKILLS;
  const map = new Map();
  Object.entries(base).forEach(([id, s]) => map.set(id, { id, ...s, _source: 'game' }));
  (draft()[KIND[kind].bucket] || []).forEach(s => map.set(s.id, { ...s, _source: 'draft' }));
  return Array.from(map.values());
}

/** 効果の説明(desc を書いていなければ自動で作る) */
export function describe(skill, kind) {
  if (skill.desc) return skill.desc;
  return kind === 'leader' ? G.describeLeaderSkill(skill) : G.describeActiveSkill(skill);
}

/* ===================== 編集画面 ===================== */

function partBox(picked, index, kind) {
  const part = partsFor(kind).find(p => p.key === picked.key);
  if (!part) return '';
  const inputs = part.fields.map(f => {
    const value = picked.values[f.key];
    if (f.type === 'aura') {
      const opts = AURA_KEYS.map(k =>
        `<option value="${k}"${value === k ? ' selected' : ''}>${esc(AURA_LABEL[k])}</option>`).join('');
      return `<label class="small">${esc(f.label)}
        <select class="mini" data-pf="${f.key}" style="width:auto">${opts}</select></label>`;
    }
    return `<label class="small">${esc(f.label)}
      <input class="mini" type="number" data-pf="${f.key}"
        min="${f.min}" max="${f.max}" step="${f.step}" value="${value}"></label>`;
  }).join('');

  return `<div class="slot slot-stack" data-part="${index}">
    <div class="slot-line">
      <b class="grow" style="font-size:12px">${esc(part.label)}</b>
      <button class="icon-btn" data-drop-part="${index}" aria-label="外す"
        style="width:28px;height:28px;flex:0 0 28px;font-size:13px">✕</button>
    </div>
    ${part.hint ? `<div class="slot-line"><span class="small"
      style="color:var(--ink-faint)">${esc(part.hint)}</span></div>` : ''}
    ${inputs ? `<div class="slot-line" style="flex-wrap:wrap">${inputs}</div>` : ''}
  </div>`;
}

/** 画面のパーツ欄を読み取る */
function readParts(root, kind) {
  return Array.from(root.querySelectorAll('[data-part]')).map(box => {
    const key = editing.picked[Number(box.dataset.part)].key;
    const part = partsFor(kind).find(p => p.key === key);
    const values = {};
    box.querySelectorAll('[data-pf]').forEach(input => {
      const f = part.fields.find(x => x.key === input.dataset.pf);
      values[input.dataset.pf] = f && f.type === 'aura' ? input.value : Number(input.value);
    });
    return { key, values };
  });
}

/** いまの組み立て結果を、ゲームに渡る形で返す */
function buildSkill() {
  const e = editing;
  const body = compose(e.picked, e.kind);
  const out = { id: e.id, name: e.name, ...body };
  if (e.kind === 'active') out.cooldown = e.cooldown;
  const auto = e.kind === 'leader' ? G.describeLeaderSkill(out) : G.describeActiveSkill(out);
  // 説明欄が空なら、いまのパーツから毎回作り直す。
  // 元のスキルの文言を持ち回ると、倍率を変えたのに説明だけ古いまま残る。
  out.desc = e.desc || auto;
  return { skill: out, auto };
}

function renderEditor(view, back) {
  const e = editing;
  const kind = e.kind;
  const meta = KIND[kind];
  const { skill, auto } = buildSkill();
  const unused = partsFor(kind).filter(p => !e.picked.some(x => x.key === p.key));

  view.innerHTML = `
    ${card(e._new ? `${meta.label}を新規作成` : `${e.name} を編集`, `
      <p class="lead">既存のスキルは、下のパーツの組み合わせでできています。
      足し引きして倍率を変え、名前を付ければ新しい${esc(meta.label)}になります。</p>
      <div class="grid2">
        ${field('ID', 'id', e.id, { placeholder: `${meta.prefix}…` })}
        ${field('名前', 'name', e.name)}
      </div>
      <p class="small" style="color:var(--ink-faint);margin:-4px 0 10px">
        既存と同じIDにすると、そのスキルを上書きします(倍率だけ直したいとき)。</p>
      ${kind === 'active'
        ? field('クールタイム', 'cooldown', e.cooldown, {
            type: 'number', min: 3, max: 20, hint: '何ターンで再使用できるか' })
        : ''}

      <h3 style="margin-top:12px">効果のパーツ (${e.picked.length})</h3>
      <div id="partList">${e.picked.length
        ? e.picked.map((p, i) => partBox(p, i, kind)).join('')
        : '<p class="empty">まだ何も入っていません。下から足してください。</p>'}</div>
      ${unused.length ? `
        <label class="field" style="margin-top:8px"><span>パーツを足す</span>
          <select id="addPart">
            <option value="">選んでください</option>
            ${unused.map(p => `<option value="${p.key}">${esc(p.label)}</option>`).join('')}
          </select></label>` : '<p class="empty">使えるパーツは全部入っています。</p>'}

      <h3 style="margin-top:12px">できあがり</h3>
      <div class="note" style="margin-bottom:8px">
        <b>${esc(skill.name || '(名前なし)')}</b><br>
        <span class="small">${esc(auto || '効果なし')}</span>
        ${kind === 'active' ? `<br><span class="small">CT ${esc(e.cooldown)}</span>` : ''}
      </div>
      ${field('説明文', 'desc', e.desc === auto ? '' : e.desc, {
        type: 'textarea', rows: 2,
        placeholder: auto || '効果を足すと自動で入ります',
        hint: '空なら上の自動生成をそのまま使う' })}
      ${e.desc && e.desc !== auto ? `<div class="warn">
        説明文を手で書いているので、パーツを変えてもこの文のままになります。<br>
        自動に戻すなら空にしてください。</div>` : ''}

      <div class="row-btns" style="margin-top:14px">
        <button class="btn primary" id="saveSkill">下書きに保存</button>
        <button class="btn" id="cancelSkill">やめる</button>
        ${find(meta.bucket, e.id) ? '<button class="btn danger" id="dropSkill">下書きから消す</button>' : ''}
      </div>`)}
  `;

  const sync = () => {
    const v = readForm(view.querySelector('.card'));
    e.id = String(v.id || '').trim();
    e.name = String(v.name || '').trim();
    if (kind === 'active') e.cooldown = Math.max(3, Math.min(20, Math.round(Number(v.cooldown) || 8)));
    e.desc = String(v.desc || '').trim();
    e.picked = readParts($('partList'), kind);
  };

  const addPart = $('addPart');
  if (addPart) addPart.addEventListener('change', () => {
    if (!addPart.value) return;
    sync();
    e.picked.push(defaultsOf(addPart.value, kind));
    renderEditor(view, back);
  });

  $('partList').addEventListener('click', ev => {
    const drop = ev.target.closest('[data-drop-part]');
    if (!drop) return;
    sync();
    e.picked.splice(Number(drop.dataset.dropPart), 1);
    renderEditor(view, back);
  });
  $('partList').addEventListener('input', () => { sync(); renderEditor(view, back); });
  $('partList').addEventListener('change', () => { sync(); renderEditor(view, back); });

  $('saveSkill').addEventListener('click', () => {
    sync();
    if (!/^[a-z0-9_]+$/i.test(e.id)) { toast('IDは英数字とアンダースコアだけにしてください', 'ng'); return; }
    if (!e.name) { toast('名前を入れてください', 'ng'); return; }
    if (!e.picked.length) { toast('効果のパーツを1つ以上入れてください', 'ng'); return; }
    upsert(meta.bucket, buildSkill().skill);
    toast('下書きに保存しました', 'ok');
    editing = null;
    back();
  });
  $('cancelSkill').addEventListener('click', () => { editing = null; back(); });
  const dropBtn = $('dropSkill');
  if (dropBtn) dropBtn.addEventListener('click', async () => {
    if (!await confirmAsk('下書きから消す', `${e.name} を捨てますか？`, '消す')) return;
    remove(meta.bucket, e.id);
    editing = null;
    back();
  });
}

/* ===================== 外から呼ぶ入口 ===================== */

export function isEditing() { return !!editing; }
export function renderEditing(view, back) { renderEditor(view, back); }

/** 新規作成をはじめる */
export function startNew(kind, view, back) {
  editing = {
    kind, _new: true,
    id: '', name: '', cooldown: 8, desc: '',
    picked: [defaultsOf(kind === 'leader' ? 'auraAtk' : 'timeThisTurn', kind)]
  };
  renderEditor(view, back);
}

/**
 * 既存のスキルを分解して編集をはじめる。
 * copy を立てると別IDの新しいスキルとして作る(元は触らない)。
 */
export function startFrom(kind, id, view, back, copy) {
  const src = allSkills(kind).find(s => s.id === id);
  if (!src) return;
  const picked = decompose(src, kind);
  editing = {
    kind,
    _new: copy || src._source !== 'draft',
    id: copy ? `${src.id}_x` : src.id,
    name: copy ? `${src.name}・改` : src.name,
    cooldown: src.cooldown || 8,
    // 複製のときは元の文言を引き継がない。倍率を変えるのが目的なので、
    // 元の説明が残っていると中身と食い違う。自分の下書きなら自分の上書きなので残す。
    desc: copy ? '' : (src.desc || ''),
    picked: picked.length ? picked : [defaultsOf(kind === 'leader' ? 'auraAtk' : 'timeThisTurn', kind)]
  };
  renderEditor(view, back);
}
