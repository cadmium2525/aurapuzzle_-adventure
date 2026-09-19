/* =========================================================
 * characters.js — ガチャに出るキャラクターの追加と確認
 *
 * ロールを選ぶとステータスが自動で出る(既存キャラと同じ計算を使い、
 * ±8%の揺らぎを足す)。そこから手で詰められる。
 * 進化前・進化後をまとめて設定し、画像はツール内で webp にする。
 * =======================================================*/
import { $, esc, card, toast, field, readForm, clampInt, modal, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, upsert, remove, find, putBlob, getBlob } from '../draft.js';
import { allSkills, describe } from './skill-edit.js';
import { toWebp, toIconWebp, toBannerWebp, previewUrl, humanSize, canEncodeWebp } from '../image.js';
import { acquisitionOf, acquisitionFlags } from '../character-acquisition.js';

/** ホームでの寄せ具合。小数を保つので clampInt は使えない(1.15 が 1 に丸まる) */
function clampScale(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback ?? 1;
  return Math.min(2, Math.max(0.5, Math.round(n * 100) / 100));
}

let editing = null;

/* --- characters.js と同じ基準値。あちらは非公開なので写している。
       ここを変えるときは src/js/data/characters.js も一緒に直すこと --- */
const RARITY_BASE = {
  1: { atk: 8, hp: 14, rcv: 6 }, 2: { atk: 14, hp: 24, rcv: 9 },
  3: { atk: 22, hp: 38, rcv: 13 }, 4: { atk: 34, hp: 56, rcv: 18 },
  5: { atk: 52, hp: 84, rcv: 27 }
};
const ROLE_WEIGHT = {
  attacker: { atk: 1.25, hp: 0.85, rcv: 0.7 },
  balance: { atk: 1.00, hp: 1.00, rcv: 1.0 },
  tank: { atk: 0.80, hp: 1.35, rcv: 0.9 },
  healer: { atk: 0.70, hp: 0.95, rcv: 1.7 }
};

/** ロールとレアリティから、ばらつきを含んだステータスを引く */
function rollStats(rarity, role) {
  const base = RARITY_BASE[rarity] || RARITY_BASE[3];
  const w = ROLE_WEIGHT[role] || ROLE_WEIGHT.balance;
  const jitter = () => 0.92 + Math.random() * 0.16;   // ±8%
  return {
    atk: Math.round(base.atk * w.atk * jitter()),
    hp: Math.round(base.hp * w.hp * jitter()),
    rcv: Math.round(base.rcv * w.rcv * jitter())
  };
}

/** 揺らぎ無しの基準値(「標準に戻す」用) */
function exactStats(rarity, role) {
  const base = RARITY_BASE[rarity] || RARITY_BASE[3];
  const w = ROLE_WEIGHT[role] || ROLE_WEIGHT.balance;
  return {
    atk: Math.round(base.atk * w.atk),
    hp: Math.round(base.hp * w.hp),
    rcv: Math.round(base.rcv * w.rcv)
  };
}

/* ===================== 一覧 ===================== */

function allCharacters() {
  const map = new Map();
  G.CHARACTERS.forEach(c => map.set(c.id, { ...c, _source: 'game' }));
  draft().characters.forEach(c => map.set(c.id, { ...c, _source: 'draft' }));
  return Array.from(map.values());
}

function iconOf(c) {
  const stage = (c.artStages || [])[0];
  return stage && stage.icon
    ? `<img class="thumb" src="../${esc(stage.icon)}" alt="" loading="lazy"
        onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'emoji',textContent:'${esc(c.portrait || '🙂')}'}))">`
    : `<div class="emoji">${esc(c.portrait || '🙂')}</div>`;
}

function cell(c) {
  const tag = c._source === 'draft' ? '<span class="tagline new">下書き</span>'
    : `<span class="tagline">★${esc(c.rarity)}</span>`;
  return `<button class="icon-cell" data-open="${esc(c.id)}">
    ${tag}${iconOf(c)}<span class="cap">${esc(c.name)}</span></button>`;
}

function renderList(view) {
  const list = allCharacters();
  const byAura = G.AURA_NAME.map((name, i) => ({
    name, list: list.filter(c => c.aura === i)
  }));

  view.innerHTML = `
    ${card(`キャラクター (${list.length})`, `
      <p class="lead">ガチャの母集団は ${G.GACHA_POOL.length} 体（★${G.MAX_GACHA_RARITY}まで・配布限定を除く）。</p>
      ${byAura.map(g => g.list.length ? `
        <h3>${esc(g.name)} (${g.list.length})</h3>
        <div class="icon-grid" style="margin-bottom:12px">${g.list.map(cell).join('')}</div>` : '').join('')}`,
      '<button class="btn primary" id="newChar">＋ 新キャラ実装</button>')}
  `;
  $('newChar').addEventListener('click', () => {
    const stats = exactStats(3, 'balance');
    editing = {
      id: '', name: '', job: '', portrait: '🙂', aura: 0, rarity: 3, role: 'balance',
      artScale1: 1, artScale2: 1,
      leaderSkillId: Object.keys(G.LEADER_SKILLS)[0],
      skillId: Object.keys(G.ACTIVE_SKILLS)[0],
      ...stats, flavor: '',
      evolve: false, evoName: '', evoJob: '', evoLeaderSkillId: '', evoSkillId: '',
      artName: '', _new: true
    };
    renderEditor(view);
  });
  view.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
    openDetail(view, b.dataset.open);
  }));
}

/* ===================== 詳細(既存キャラ) ===================== */

function openDetail(view, id) {
  const c = allCharacters().find(x => x.id === id);
  if (!c) return;
  const inDraft = !!find('characters', id);
  const ls = G.LEADER_SKILLS[c.leaderSkillId];
  const sk = G.ACTIVE_SKILLS[c.skillId];

  modal(c.name, `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
      <div style="width:96px;flex:0 0 96px">${iconOf(c).replace('class="thumb"', 'class="thumb" style="border-radius:12px"')}</div>
      <div>
        <b>${esc(c.name)}</b><br>
        <span class="small" style="color:var(--ink-dim)">${esc(c.job || '')}</span><br>
        <span class="small">${esc(G.AURA_NAME[c.aura])} ・ ★${esc(c.rarity)}
          (${esc(G.RARITY_TITLE[c.rarity])}) ・ ${esc(G.ROLE_LABEL[c.role] || c.role)}</span>
      </div>
    </div>
    <dl class="kv">
      <dt>ID</dt><dd class="mono">${esc(c.id)}</dd>
      <dt>ATK / HP / 回復</dt><dd>${esc(c.atk)} / ${esc(c.hp)} / ${esc(c.rcv)}</dd>
      <dt>Lv上限</dt><dd>${esc(G.MAX_LEVEL[c.rarity] || '?')}</dd>
      <dt>リーダー</dt><dd>${ls ? esc(ls.name) : '—'}<br>
        <span class="small" style="color:var(--ink-dim)">${ls ? esc(ls.desc) : ''}</span></dd>
      <dt>スキル</dt><dd>${sk ? esc(sk.name) : '—'}<br>
        <span class="small" style="color:var(--ink-dim)">${sk ? esc(sk.desc) : ''}</span></dd>
      ${c.evoName ? `<dt>進化後</dt><dd>${esc(c.evoName)}${c.evoJob ? ` / ${esc(c.evoJob)}` : ''}</dd>` : ''}
      ${c.raidDrop ? '<dt>入手</dt><dd>降臨ドロップ</dd>' : ''}
      ${c.giftOnly ? '<dt>ガチャ</dt><dd>対象外(配布限定)</dd>' : ''}
    </dl>
    ${c.flavor ? `<p class="small" style="color:var(--ink-dim)">${esc(c.flavor)}</p>` : ''}
  `, {
    okLabel: inDraft ? 'この下書きを編集' : null,
    cancelLabel: '閉じる'
  }).then(ok => {
    if (ok && inDraft) { editing = { ...toEditing(find('characters', id)), _new: false }; renderEditor(view); }
  });
}

/* ===================== 新規作成 ===================== */

function artPaths(name) {
  return {
    icon1: `assets/chars/${name}_1_icon.webp`, full1: `assets/chars/${name}_1.webp`,
    icon2: `assets/chars/${name}_2_icon.webp`, full2: `assets/chars/${name}_2.webp`,
    banner: `assets/banner/${name}.webp`
  };
}

function shot(path) {
  const blob = getBlob(path);
  if (!blob) return '';
  return `<div class="shot"><img src="${previewUrl(blob)}" alt="">
    <span class="cap">${esc(path.split('/').pop())}<br>${humanSize(blob.size)}</span></div>`;
}

function renderEditor(view) {
  const c = editing;
  // 下書きで作ったスキルもここから選べる(先に作っておけば新キャラに付けられる)
  const label = (s, kind) => `${s.name}${s._source === 'draft' ? '（下書き）' : ''} — ${describe(s, kind)}`;
  const lsOpts = allSkills('leader').map(s => [s.id, label(s, 'leader')]);
  const skOpts = allSkills('active').map(s => [s.id, label(s, 'active')]);
  const art = artPaths(c.artName || c.id || 'new');
  const exact = exactStats(c.rarity, c.role);

  view.innerHTML = `
    ${card(c._new ? '新キャラ実装' : `${c.name} を編集`, `
      <div class="grid2">
        ${field('ID', 'id', c.id, { hint: '例: fl_nova。オーラの接頭辞をつけると探しやすい' })}
        ${field('画像の名前', 'artName', c.artName, { hint: 'assets/chars/〇〇_1.webp の〇〇' })}
      </div>
      <div class="grid2">
        ${field('名前', 'name', c.name)}
        ${field('肩書き', 'job', c.job)}
      </div>
      <div class="grid3">
        ${field('オーラ', 'aura', c.aura, { type: 'select', options: G.AURA_NAME.map((n, i) => [i, n]) })}
        ${field('レアリティ', 'rarity', c.rarity, {
          type: 'select', options: [1, 2, 3, 4].map(r => [r, `★${r} ${G.RARITY_TITLE[r]}`]) })}
        ${field('絵文字', 'portrait', c.portrait, { hint: '画像が無いとき' })}
      </div>
      ${field('ロール', 'role', c.role, {
        type: 'select', options: Object.keys(ROLE_WEIGHT).map(r => [r, G.ROLE_LABEL[r] || r]) })}
      ${field('入手方法', 'acquisition', c.acquisition || acquisitionOf(c), {
        type: 'select', options: [['gacha', 'ガチャ'], ['gift', '配布限定（ガチャ対象外）'], ['raid', '降臨ドロップ限定（ガチャ対象外・開眼10段階）']] })}
      <p class="lead small">降臨ドロップ限定は開眼でドロップ率が上がります。ドロップ先と基本確率は降臨タブで設定してください。</p>

      <h3 style="margin-top:12px">ステータス (Lv1)</h3>
      <p class="lead small">ロールとレアリティから自動で出します。標準値は
        ATK ${exact.atk} / HP ${exact.hp} / 回復 ${exact.rcv}。</p>
      <div class="row-btns">
        <button class="btn" id="rollBtn">🎲 引き直す</button>
        <button class="btn" id="exactBtn">標準値にする</button>
      </div>
      <div class="grid3">
        ${field('ATK', 'atk', c.atk, { type: 'number', min: 1, max: 999 })}
        ${field('HP', 'hp', c.hp, { type: 'number', min: 1, max: 9999 })}
        ${field('回復', 'rcv', c.rcv, { type: 'number', min: 0, max: 999 })}
      </div>

      <h3 style="margin-top:12px">スキル</h3>
      ${field('リーダースキル', 'leaderSkillId', c.leaderSkillId, { type: 'select', options: lsOpts })}
      ${field('スキル', 'skillId', c.skillId, { type: 'select', options: skOpts })}
      ${field('フレーバー', 'flavor', c.flavor, { type: 'textarea', rows: 2 })}

      <h3 style="margin-top:12px">進化</h3>
      <label class="field"><span>
        <input type="checkbox" id="evolveBox"${c.evolve ? ' checked' : ''} style="width:auto;margin-right:6px">
        進化後を別の姿・名前にする</span></label>
      ${c.evolve ? `
        <div class="grid2">
          ${field('進化後の名前', 'evoName', c.evoName)}
          ${field('進化後の肩書き', 'evoJob', c.evoJob)}
        </div>
        ${field('進化後のリーダースキル', 'evoLeaderSkillId', c.evoLeaderSkillId,
          { type: 'select', options: [['', '（強化版を自動生成）']].concat(lsOpts) })}
        ${field('進化後のスキル', 'evoSkillId', c.evoSkillId,
          { type: 'select', options: [['', '（強化版を自動生成）']].concat(skOpts) })}
        <p class="lead small">空のままなら、既存キャラと同じく倍率を盛った強化版が自動で作られます。</p>
      ` : '<p class="lead small">オフなら、進化しても同じ名前・同じ絵のままです。</p>'}

      <h3 style="margin-top:12px">画像</h3>
      <p class="lead small">選ぶとツール内で webp にします。
        1枚絵は長辺1024px、アイコンは128px角、バナーは1080×400。</p>
      <div class="grid2">
        <label class="drop">進化前の1枚絵<input type="file" accept="image/*" data-pic="full1"></label>
        <label class="drop">進化前のアイコン<input type="file" accept="image/*" data-pic="icon1"></label>
      </div>
      ${c.evolve ? `<div class="grid2" style="margin-top:8px">
        <label class="drop">進化後の1枚絵<input type="file" accept="image/*" data-pic="full2"></label>
        <label class="drop">進化後のアイコン<input type="file" accept="image/*" data-pic="icon2"></label>
      </div>` : ''}
      <label class="drop" style="margin-top:8px">ガチャバナー
        <input type="file" accept="image/*" data-pic="banner"></label>
      <div class="shots">${['full1', 'icon1', 'full2', 'icon2', 'banner'].map(k => shot(art[k])).join('')}</div>

      <h3 style="margin-top:12px">ホームでの大きさ</h3>
      <p class="lead small">ホームの1枚絵は、余白ごと枠に収めるので
        <b>絵の縦横比で見た目の大きさが変わります</b>。横長の絵ほど小さく見えるので、
        ここで引き伸ばして揃えます。1 のままなら等倍。
        上げすぎると頭がバナーの裏に隠れるので、実際の画面で確かめること。</p>
      <div class="grid2">
        ${field('進化前', 'artScale1', c.artScale1 ?? 1, { type: 'number', min: 0.5, max: 2, step: 0.01 })}
        ${c.evolve ? field('進化後', 'artScale2', c.artScale2 ?? 1, { type: 'number', min: 0.5, max: 2, step: 0.01 }) : ''}
      </div>

      <div class="row-btns" style="margin-top:14px">
        <button class="btn primary" id="saveBtn">下書きに保存</button>
        <button class="btn" id="cancelBtn">やめる</button>
        ${find('characters', c.id) ? '<button class="btn danger" id="dropBtn">下書きから消す</button>' : ''}
      </div>`)}
  `;

  view.addEventListener('change', e => {
    if (e.target.matches('[name=rarity],[name=role]')) {
      collect(view);
      Object.assign(c, rollStats(c.rarity, c.role));
      renderEditor(view);
    }
  });
  $('rollBtn').addEventListener('click', () => {
    collect(view);
    Object.assign(c, rollStats(c.rarity, c.role));
    renderEditor(view);
  });
  $('exactBtn').addEventListener('click', () => {
    collect(view);
    Object.assign(c, exactStats(c.rarity, c.role));
    renderEditor(view);
  });
  $('evolveBox').addEventListener('change', e => {
    collect(view);
    c.evolve = e.target.checked;
    if (c.evolve && !c.evoName) c.evoName = c.name;
    renderEditor(view);
  });

  view.querySelectorAll('[data-pic]').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!canEncodeWebp()) { toast('この端末は webp を書き出せません', 'ng'); return; }
      collect(view);
      const kind = input.dataset.pic;
      const paths = artPaths(c.artName || c.id || 'new');
      try {
        let blob;
        if (kind === 'banner') blob = await toBannerWebp(file);
        else if (kind.startsWith('icon')) blob = await toIconWebp(file);
        else blob = await toWebp(file);
        putBlob(paths[kind], blob);
        toast(`webp にしました (${humanSize(blob.size)})`, 'ok');
        renderEditor(view);
      } catch (err) { toast(String(err.message || err), 'ng'); }
    });
  });

  $('saveBtn').addEventListener('click', () => {
    collect(view);
    if (!/^[a-z0-9_]+$/i.test(c.id)) { toast('IDは英数字とアンダースコアだけにしてください', 'ng'); return; }
    if (!c.name) { toast('名前を入れてください', 'ng'); return; }
    if (G.CHARACTERS.some(x => x.id === c.id) && c._new) {
      toast('そのIDは既にあります', 'ng'); return;
    }
    upsert('characters', build(c));
    toast('下書きに保存しました', 'ok');
    editing = null;
    renderList(view);
  });
  $('cancelBtn').addEventListener('click', () => { editing = null; renderList(view); });
  const dropBtn = $('dropBtn');
  if (dropBtn) dropBtn.addEventListener('click', async () => {
    if (!await confirmAsk('下書きから消す', `${c.name} を捨てますか？`, '消す')) return;
    remove('characters', c.id);
    editing = null;
    renderList(view);
  });
}

/**
 * 保存した1件を編集用の形へ戻す。
 * build() は画像の名前を _artName に、進化の有無は artStages の段数に
 * 畳んでいるので、開き直すときはそこから組み立て直す。
 * (これをしないと、開いて保存し直すだけで画像の置き場所が変わり、
 *  進化後の絵と肩書きが落ちる)
 */
function toEditing(saved) {
  return {
    ...saved,
    acquisition: acquisitionOf(saved),
    artName: saved._artName || '',
    evolve: (saved.artStages || []).length > 1,
    artScale1: (saved.artStages || [])[0]?.scale || 1,
    artScale2: (saved.artStages || [])[1]?.scale || 1
  };
}

/** 保存する形(custom.js に入る1件)を作る */
function build(c) {
  const name = c.artName || c.id;
  const out = {
    id: c.id, name: c.name, job: c.job, portrait: c.portrait || '🙂',
    aura: c.aura, rarity: c.rarity, role: c.role,
    leaderSkillId: c.leaderSkillId, skillId: c.skillId,
    atk: c.atk, hp: c.hp, rcv: c.rcv,
    ...acquisitionFlags(c.acquisition || acquisitionOf(c))
  };
  if (c.flavor) out.flavor = c.flavor;
  out.artStages = c.evolve
    ? [
      { star: c.rarity, minLevel: 1, icon: `assets/chars/${name}_1_icon.webp`, full: `assets/chars/${name}_1.webp`, label: '通常' },
      { star: c.rarity + 1, minLevel: 1, icon: `assets/chars/${name}_2_icon.webp`, full: `assets/chars/${name}_2.webp`, label: '進化' }
    ]
    : [{ star: c.rarity, minLevel: 1, icon: `assets/chars/${name}_1_icon.webp`, full: `assets/chars/${name}_1.webp`, label: '通常' }];
  // ホームでの寄せ具合。等倍なら書かない(既定値なので持たせる意味がない)
  if (c.artScale1 && c.artScale1 !== 1) out.artStages[0].scale = c.artScale1;
  if (c.evolve && c.artScale2 && c.artScale2 !== 1) out.artStages[1].scale = c.artScale2;
  if (c.evolve) {
    if (c.evoName) out.evoName = c.evoName;
    if (c.evoJob) out.evoJob = c.evoJob;
    if (c.evoLeaderSkillId) out.evoLeaderSkillId = c.evoLeaderSkillId;
    if (c.evoSkillId) out.evoSkillId = c.evoSkillId;
  }
  out._artName = name;   // リリース画面が画像の置き場所を知るために持っておく
  return out;
}

function collect(view) {
  const c = editing;
  const v = readForm(view.querySelector('.card'));
  c.id = String(v.id || '').trim();
  c.artName = String(v.artName || '').trim();
  c.name = String(v.name || '').trim();
  c.job = String(v.job || '').trim();
  c.portrait = String(v.portrait || '🙂').trim();
  c.aura = clampInt(v.aura, 0, 4, c.aura);
  c.rarity = clampInt(v.rarity, 1, G.MAX_GACHA_RARITY, c.rarity);
  c.role = v.role || c.role;
  c.acquisition = v.acquisition || c.acquisition || acquisitionOf(c);
  c.atk = clampInt(v.atk, 1, 999, c.atk);
  c.hp = clampInt(v.hp, 1, 9999, c.hp);
  c.rcv = clampInt(v.rcv, 0, 999, c.rcv);
  c.leaderSkillId = v.leaderSkillId || c.leaderSkillId;
  c.skillId = v.skillId || c.skillId;
  c.flavor = String(v.flavor || '').trim();
  // 倍率なので clampInt は使えない(丸めると 1.15 が 1 になる)
  c.artScale1 = clampScale(v.artScale1, c.artScale1);
  if (v.artScale2 != null) c.artScale2 = clampScale(v.artScale2, c.artScale2);
  if (v.evoName != null) c.evoName = String(v.evoName).trim();
  if (v.evoJob != null) c.evoJob = String(v.evoJob).trim();
  if (v.evoLeaderSkillId != null) c.evoLeaderSkillId = v.evoLeaderSkillId;
  if (v.evoSkillId != null) c.evoSkillId = v.evoSkillId;
}

export default {
  render(view) {
    if (editing) renderEditor(view); else renderList(view);
  }
};
