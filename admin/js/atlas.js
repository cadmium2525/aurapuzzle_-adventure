/* =========================================================
 * atlas.js — キャラクターアイコンのアトラスを焼き直す
 *
 * 普段は scripts/build-char-atlas.py がやっている仕事を、
 * ブラウザの canvas で同じ結果になるようにやる。
 * (Python を回せない端末からでもキャラを足せるようにするため)
 *
 * 焼き直しは必須ではない。アトラスに無いアイコンは core/ui.js の
 * charIcon() が <img> へフォールバックするので、足しただけでも表示はされる。
 * ここを通すと一覧のリクエストが1回にまとまって軽くなる。
 *
 * 出すもの:
 *   assets/chars/char_atlas.webp  … 格子状の1枚絵
 *   src/js/data/char-atlas.js     … 元のパス → [列, 行] の索引
 * =======================================================*/
import { CHAR_ATLAS, CHAR_ATLAS_COLUMNS } from '../../src/js/data/char-atlas.js';

/** build-char-atlas.py と同じ値。ここを変えるなら向こうも変えること */
export const CELL = 128;
export const COLUMNS = CHAR_ATLAS_COLUMNS || 8;

/** 画面の object-fit:cover と同じ見え方になるよう、中央で正方形に切る */
function drawSquared(ctx, img, dx, dy, size) {
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, dx, dy, size, size);
}

function loadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${url} が読めませんでした`));
    img.src = url;
  });
}

function loadFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像が読めませんでした')); };
    img.src = url;
  });
}

/**
 * 焼き直しに使うアイコンの一覧を作る。
 * いまアトラスに入っているものに、下書きで足したぶんを重ねる。
 * @param {Array<string>} extraPaths 下書きで足したアイコンのパス
 */
export function atlasSources(extraPaths) {
  const paths = Object.keys(CHAR_ATLAS);
  (extraPaths || []).forEach(p => { if (p && !paths.includes(p)) paths.push(p); });
  return paths.sort();   // py 版と同じく名前順。差分が読みやすい
}

/**
 * アトラスを焼く。
 * @param {Array<string>} paths  焼く対象(assets/chars/xxx_icon.webp)
 * @param {(path:string)=>Blob|null} blobOf 下書きが持っている画像を引く
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<{blob:Blob, index:object, columns:number, rows:number, missing:string[]}>}
 */
export async function buildAtlas(paths, blobOf, onProgress) {
  const rows = Math.max(1, Math.ceil(paths.length / COLUMNS));
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const index = {};
  const missing = [];
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    if (onProgress) onProgress(i + 1, paths.length);
    let img = null;
    try {
      // 下書きで差し替えたものを優先する(まだ push していないため)
      const held = blobOf ? blobOf(path) : null;
      img = held ? await loadFromBlob(held) : await loadFromUrl(`../${path}`);
    } catch {
      missing.push(path);
      continue;                       // 読めなかった枠は空けておく
    }
    drawSquared(ctx, img, col * CELL, row * CELL, CELL);
    index[path] = [col, row];
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('webp に変換できませんでした'))),
      'image/webp', 0.92);
  });
  return { blob, index, columns: COLUMNS, rows, missing };
}

/** src/js/data/char-atlas.js の中身を組み立てる */
export function buildAtlasIndexJs({ index, columns, rows }) {
  const lines = Object.keys(index).sort()
    .map(p => `  '${p}': [${index[p][0]}, ${index[p][1]}]`)
    .join(',\n');
  return `/* =========================================================
 * char-atlas.js — キャラクターアイコンの格子位置
 *
 * scripts/build-char-atlas.py か admin/ の「アトラスを焼き直す」が生成する。
 * 手で編集しない。イラストを足したらどちらかを流し直すこと。
 * =======================================================*/
export const CHAR_ATLAS_SRC = 'assets/chars/char_atlas.webp';
export const CHAR_ATLAS_COLUMNS = ${columns};
export const CHAR_ATLAS_ROWS = ${rows};

/** 元のアイコンのパス → [列, 行] */
export const CHAR_ATLAS = {
${lines}
};
`;
}
