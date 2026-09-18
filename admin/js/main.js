/* =========================================================
 * main.js — 画面の切り替えと設定
 * =======================================================*/
import { $, toast, modal, esc, field, readForm } from './ui.js';
import * as gh from './github.js';
import { onChange, pendingCount } from './draft.js';

import home from './views/home.js';
import enemies from './views/enemies.js';
import raids from './views/raids.js';
import characters from './views/characters.js';
import skills from './views/skills.js';
import tools from './views/tools.js';
import release from './views/release.js';

const SCREENS = { home, enemies, raids, characters, skills, tools, release };
const TITLES = {
  home: '管理ツール', enemies: 'モンスター', raids: '降臨ダンジョン',
  characters: 'キャラクター', skills: 'スキル一覧', tools: '点検', release: 'リリース'
};

/** 画面の中の階層(一覧→詳細)から戻るための積み場所 */
let backStack = [];
let current = 'home';

/**
 * 画面を描く。
 * @param {string} name SCREENS のキー
 * @param {object} params 画面ごとの引数(詳細を開くときのIDなど)
 * @param {boolean} push 戻る先として積むか
 */
export function show(name, params = {}, push = false) {
  if (!SCREENS[name]) name = 'home';
  if (push) backStack.push({ name: current, params: currentParams });
  else backStack = [];
  current = name;
  currentParams = params;
  $('screenTitle').textContent = params.title || TITLES[name] || '管理ツール';
  $('backBtn').hidden = backStack.length === 0;
  document.querySelectorAll('#tabs .tab').forEach(t => {
    t.classList.toggle('on', t.dataset.go === name);
  });
  const view = $('view');
  view.scrollTop = 0;
  view.innerHTML = '';
  try {
    SCREENS[name].render(view, params);
  } catch (e) {
    view.innerHTML = `<section class="card"><h2>表示できませんでした</h2>
      <pre class="err">${esc(e && e.stack ? e.stack : e)}</pre></section>`;
  }
  window.scrollTo(0, 0);
}
let currentParams = {};

function goBack() {
  const prev = backStack.pop();
  if (!prev) { show('home'); return; }
  const stack = backStack.slice();
  show(prev.name, prev.params);
  backStack = stack;
  $('backBtn').hidden = backStack.length === 0;
}

/* ===================== 設定(トークン) ===================== */

async function openSettings() {
  const repo = gh.getRepo();
  const token = gh.getToken();
  await modal('設定', `
    <p class="lead">GitHub の <b>Fine-grained personal access token</b> を使います。
    権限はこのリポジトリの <b>Contents: Read and write</b> だけで足ります。</p>
    <div class="warn">
      トークンはこの端末の localStorage に保存されます。<b>端末を触れる人には読めます</b>。
      共用端末では使わないでください。リポジトリには絶対に入りません。
    </div>
    ${field('アクセストークン', 'token', token, { type: 'password', hint: 'github_pat_... / ghp_...' })}
    ${field('オーナー', 'owner', repo.owner)}
    ${field('リポジトリ', 'repo', repo.repo)}
    ${field('ブランチ', 'branch', repo.branch, { hint: 'push 先' })}
    <div class="row-btns">
      <button class="btn" id="testBtn">接続を確認</button>
      <button class="btn danger" id="forgetBtn">トークンを消す</button>
    </div>
    <p class="mono small" id="testOut"></p>
  `, {
    okLabel: '保存',
    collect: form => readForm(form),
    onOpen: (form, done) => {
      form.querySelector('#testBtn').addEventListener('click', async () => {
        const v = readForm(form);
        gh.setToken(v.token);
        gh.setRepo({ owner: v.owner, repo: v.repo, branch: v.branch });
        const out = form.querySelector('#testOut');
        out.textContent = '確認中…';
        try {
          const info = await gh.checkAccess();
          out.textContent = `OK: ${info.login} / ${info.repo} / 書き込み ${info.canWrite ? '可' : '不可'}`;
          out.className = 'mono small ok';
        } catch (e) {
          out.textContent = String(e.message || e);
          out.className = 'mono small ng';
        }
      });
      form.querySelector('#forgetBtn').addEventListener('click', () => {
        gh.clearToken();
        form.querySelector('[name=token]').value = '';
        toast('トークンを消しました');
        done(null);
        refreshChip();
      });
    }
  }).then(v => {
    if (!v) return null;
    gh.setToken(v.token);
    gh.setRepo({ owner: v.owner, repo: v.repo, branch: v.branch });
    toast('保存しました');
    refreshChip();
    return v;
  });
}

async function refreshChip() {
  const chip = $('repoChip');
  const repo = gh.getRepo();
  if (!gh.getToken()) {
    chip.textContent = '未接続';
    chip.className = 'repo-chip ng';
    return;
  }
  chip.textContent = `${repo.repo}@${repo.branch}`;
  chip.className = 'repo-chip';
  try {
    const info = await gh.checkAccess();
    chip.className = info.canWrite ? 'repo-chip ok' : 'repo-chip ng';
    if (!info.canWrite) chip.textContent += '(読取専用)';
  } catch {
    chip.className = 'repo-chip ng';
    chip.textContent += '(エラー)';
  }
}

function refreshBadge() {
  const n = pendingCount();
  const badge = $('draftBadge');
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

/* ===================== 起動 ===================== */

document.querySelectorAll('#tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => show(tab.dataset.go));
});
$('backBtn').addEventListener('click', goBack);
$('settingsBtn').addEventListener('click', openSettings);
onChange(refreshBadge);

export { openSettings };

refreshBadge();
refreshChip();
show('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}
