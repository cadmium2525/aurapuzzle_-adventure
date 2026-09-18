/* =========================================================
 * github.js — GitHub とのやりとり
 *
 * ブラウザから直接 api.github.com を叩く(CORS対応済み)。
 * 複数ファイルを1コミットにまとめたいので、単純な Contents API ではなく
 * Git Data API を使う:
 *   blob を作る → tree を作る → commit を作る → ref を進める
 * こうすると「データ・画像・版上げ」が1コミットに収まり、
 * 途中で失敗しても中途半端な状態が push されない。
 *
 * ■ トークンの扱い
 * Fine-grained personal access token を localStorage に置く。
 * 必要な権限はこのリポジトリの Contents: Read and write だけ。
 * localStorage なので、**この端末を触れる人には読める**。
 * 共用端末で使わないこと。リポジトリには絶対に入れない。
 * =======================================================*/

const API = 'https://api.github.com';
const TOKEN_KEY = 'acb_admin_token';
const REPO_KEY = 'acb_admin_repo';

export const DEFAULT_REPO = { owner: 'cadmium2525', repo: 'aurapuzzle_-adventure', branch: 'main' };

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token || ''); } catch { /* プライベートモード */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

export function getRepo() {
  try {
    return Object.assign({}, DEFAULT_REPO, JSON.parse(localStorage.getItem(REPO_KEY) || '{}'));
  } catch { return { ...DEFAULT_REPO }; }
}
export function setRepo(repo) {
  try { localStorage.setItem(REPO_KEY, JSON.stringify(repo)); } catch { /* noop */ }
}

/** 認証つきで叩く。失敗はメッセージを読める形にして投げ直す */
async function call(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('アクセストークンが設定されていません');
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { /* 本文が無いこともある */ }
    if (res.status === 401) throw new Error('トークンが無効です(401)。作り直して設定し直してください');
    if (res.status === 403) throw new Error(`権限が足りません(403)。${detail}`);
    if (res.status === 404) throw new Error(`見つかりません(404)。リポジトリ名と権限を確認してください。${detail}`);
    if (res.status === 409) throw new Error('リポジトリが空か、ブランチがありません(409)');
    throw new Error(`GitHub エラー ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

const base = () => {
  const { owner, repo } = getRepo();
  return `/repos/${owner}/${repo}`;
};

/** 接続確認。ログイン名とリポジトリの書き込み可否を返す */
export async function checkAccess() {
  const me = await call('/user');
  const repo = await call(base());
  return {
    login: me.login,
    repo: repo.full_name,
    canWrite: !!(repo.permissions && repo.permissions.push),
    defaultBranch: repo.default_branch
  };
}

/* ===================== 読み取り ===================== */

/** テキストファイルを1つ読む。無ければ null */
export async function readFile(path, ref) {
  const branch = ref || getRepo().branch;
  let json;
  try {
    json = await call(`${base()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`);
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
  if (Array.isArray(json)) throw new Error(`${path} はディレクトリです`);
  // base64 を UTF-8 として読む(日本語が含まれるので atob だけでは壊れる)
  const bin = atob(json.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return { text: new TextDecoder().decode(bytes), sha: json.sha };
}

/** ブランチの先頭コミットのSHA */
export async function headSha(branch) {
  const b = branch || getRepo().branch;
  const ref = await call(`${base()}/git/ref/heads/${encodeURIComponent(b)}`);
  return ref.object.sha;
}

/* ===================== 書き込み ===================== */

/** テキスト(UTF-8)を blob にする */
async function textBlob(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  const json = await call(`${base()}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: btoa(bin), encoding: 'base64' })
  });
  return json.sha;
}

/** バイナリ(Blob/ArrayBuffer)を blob にする */
async function binaryBlob(data) {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const bytes = new Uint8Array(buf);
  let bin = '';
  // 大きい画像でも引数の上限に当たらないよう小分けにする
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  const json = await call(`${base()}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: btoa(bin), encoding: 'base64' })
  });
  return json.sha;
}

/**
 * 複数のファイルを1コミットで push する。
 * @param {Array<{path:string, text?:string, blob?:Blob}>} files
 * @param {string} message コミットメッセージ
 * @param {(done:number,total:number,label:string)=>void} onProgress
 * @returns {Promise<{sha:string, url:string}>}
 */
export async function commitFiles(files, message, onProgress) {
  const list = (files || []).filter(f => f && f.path);
  if (!list.length) throw new Error('コミットするファイルがありません');
  const { owner, repo, branch } = getRepo();
  const step = (i, label) => onProgress && onProgress(i, list.length + 3, label);

  const parent = await headSha(branch);
  step(0, '現在のコミットを取得');
  const baseCommit = await call(`${base()}/git/commits/${parent}`);

  const tree = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    step(i, `アップロード中 ${f.path}`);
    const sha = f.blob ? await binaryBlob(f.blob) : await textBlob(f.text || '');
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha });
  }

  step(list.length, 'ツリーを作成');
  const newTree = await call(`${base()}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
  });

  step(list.length + 1, 'コミットを作成');
  const commit = await call(`${base()}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] })
  });

  step(list.length + 2, 'ブランチを更新');
  await call(`${base()}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  step(list.length + 3, '完了');
  return { sha: commit.sha, url: `https://github.com/${owner}/${repo}/commit/${commit.sha}` };
}
