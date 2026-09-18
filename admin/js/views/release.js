/* =========================================================
 * release.js — 版を上げて GitHub へ push する
 *
 * やること:
 *   1. 版(3か所)を GitHub から読んで +1 する
 *   2. 下書きから custom.js を組み立てる
 *   3. 画像もまとめて、1コミットで push する
 *
 * 版は index.html / src/js/core/version.js / sw.js の3か所を
 * そろえないと、ゲームが「版ずれ」と判断して読み直しループになる。
 * ここで必ず3つ一緒に書き換える。
 * =======================================================*/
import { $, esc, card, toast, field, confirmAsk } from '../ui.js';
import * as gh from '../github.js';
import { buildCustomJs, VERSION_FILES, nextVersion } from '../custom-source.js';
import { draft, blobEntries, clearAll, pendingCount, exportJson, importJson } from '../draft.js';

let state = { versions: null, busy: false };

async function loadVersions() {
  const out = [];
  for (const f of VERSION_FILES) {
    const file = await gh.readFile(f.path);
    if (!file) throw new Error(`${f.path} が読めませんでした`);
    out.push({ ...f, text: file.text, current: f.read(file.text) });
  }
  return out;
}

function summary(d) {
  const images = blobEntries();
  return `
    <dl class="kv">
      <dt>モンスター</dt><dd>${d.enemies.length} 件</dd>
      <dt>降臨</dt><dd>${d.raids.length} 件</dd>
      <dt>キャラクター</dt><dd>${d.characters.length} 件</dd>
      <dt>画像</dt><dd>${images.length} 枚</dd>
    </dl>
    ${images.length ? `<div class="scroll-x"><table class="data">
      <tr><th>置き場所</th><th class="num">大きさ</th></tr>
      ${images.map(([p, b]) => `<tr><td class="mono">${esc(p)}</td>
        <td class="num">${(b.size / 1024).toFixed(1)} KB</td></tr>`).join('')}
    </table></div>` : ''}`;
}

export default {
  render(view) {
    const d = draft();
    const n = pendingCount();
    const images = blobEntries();
    const hasToken = !!gh.getToken();
    const repo = gh.getRepo();

    view.innerHTML = `
      ${!hasToken ? '<div class="warn">右上の ⚙ からアクセストークンを設定してください。</div>' : ''}
      ${images.length === 0 && (d.characters.length || d.enemies.length)
        ? '<div class="note">画像は端末のメモリにしか無いので、<b>再読み込みすると外れます</b>。画像を選んだら、そのまま push してください。</div>'
        : ''}

      ${card('push する内容', n === 0
        ? '<p class="empty">下書きが空です。何か編集してから戻ってきてください。</p>'
        : summary(d),
        `<button class="btn" id="exportBtn">下書きを書き出す</button>`)}

      ${card('版を上げる', `
        <p class="lead">ゲームは index.html / version.js / sw.js の3か所の版を突き合わせています。
        ずれると起動しなくなるので、ここで必ず3つ一緒に上げます。</p>
        <div id="versionBox"><button class="btn" id="loadVer">いまの版を読む</button></div>`)}

      ${card('コミット', `
        ${field('コミットメッセージ', 'message', d.notes || '管理ツールからデータを更新', { type: 'textarea', rows: 3 })}
        <p class="small" style="color:var(--ink-faint)">
          送り先: <span class="mono">${esc(repo.owner)}/${esc(repo.repo)}</span> の
          <span class="mono">${esc(repo.branch)}</span> ブランチ</p>
        <div class="bar" id="bar" hidden><i></i></div>
        <p class="small mono" id="progress"></p>
        <button class="btn primary wide" id="pushBtn"${n === 0 || !hasToken ? ' disabled' : ''}>
          版を上げて push する</button>`)}
    `;

    $('exportBtn').addEventListener('click', () => {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'acb-draft.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    $('loadVer').addEventListener('click', async () => {
      const box = $('versionBox');
      box.innerHTML = '<p class="small">読み込み中…</p>';
      try {
        state.versions = await loadVersions();
        const cur = state.versions[0].current;
        const mismatch = state.versions.some(v => v.current !== cur);
        box.innerHTML = `
          <dl class="kv">
            ${state.versions.map(v => `<dt class="mono">${esc(v.path)}</dt>
              <dd class="${v.current === cur ? '' : 'ng'}">${esc(v.current)}</dd>`).join('')}
          </dl>
          ${mismatch ? '<div class="warn">3か所がずれています。push すると揃います。</div>' : ''}
          <p class="ok">push すると <b>${esc(cur)} → ${esc(nextVersion(cur))}</b> に上がります。</p>`;
      } catch (e) {
        box.innerHTML = `<p class="ng small">${esc(e.message || e)}</p>
          <button class="btn" id="loadVer">もう一度読む</button>`;
        box.querySelector('#loadVer').addEventListener('click', () => this.render(view));
      }
    });

    $('pushBtn').addEventListener('click', async () => {
      if (state.busy) return;
      const message = view.querySelector('[name=message]').value.trim() || '管理ツールからデータを更新';
      if (!state.versions) {
        toast('先に「いまの版を読む」を押してください', 'ng');
        return;
      }
      const next = nextVersion(state.versions[0].current);
      if (!next) { toast('版の数字が読めませんでした', 'ng'); return; }
      const ok = await confirmAsk('push します',
        `版 ${state.versions[0].current} → ${next} に上げて、${n} 件を ${repo.branch} へ送ります。`, 'push する');
      if (!ok) return;

      state.busy = true;
      const bar = $('bar');
      const fill = bar.querySelector('i');
      const out = $('progress');
      bar.hidden = false;
      $('pushBtn').disabled = true;

      try {
        const files = [
          { path: 'src/js/data/custom.js', text: buildCustomJs(draft()) },
          ...state.versions.map(v => ({ path: v.path, text: v.write(v.text, next) })),
          ...blobEntries().map(([path, blob]) => ({ path, blob }))
        ];
        const result = await gh.commitFiles(files, `${message}\n\n版を ${next} に更新`,
          (done, total, label) => {
            fill.style.width = `${Math.round((done / total) * 100)}%`;
            out.textContent = label;
          });
        out.innerHTML = `<a href="${result.url}" target="_blank" rel="noopener"
          style="color:var(--link)">${result.sha.slice(0, 7)} を push しました</a>`;
        toast('push しました', 'ok');
        clearAll();
        state.versions = null;
      } catch (e) {
        out.textContent = String(e.message || e);
        out.className = 'small mono ng';
        toast(String(e.message || e), 'ng');
      } finally {
        state.busy = false;
        $('pushBtn').disabled = false;
      }
    });
  }
};

