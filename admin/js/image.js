/* =========================================================
 * image.js — アップロードした画像をツール内で webp にする
 *
 * ゲーム側の画像は全部 webp なので、PNG/JPEG を投げ込んだら
 * ここで変換してから push する。canvas.toBlob('image/webp') が
 * そのまま使える(Chrome / Safari 16 以降)。
 *
 * アイコンは一覧で丸く並ぶので、ゲームの object-fit:cover と
 * 同じ見え方になるよう中央で正方形に切ってから縮める
 * (scripts/build-char-atlas.py の squared() と同じ考え方)。
 * =======================================================*/

/** 1枚絵の最大辺。元が大きくてもここまで縮める */
export const FULL_MAX = 1024;
/** アイコンの一辺。一覧は最大64px程度なので2倍解像度で足りる */
export const ICON_SIZE = 128;
/** バナーの幅 */
export const BANNER_WIDTH = 1080;

/** File/Blob を <img> として読む */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像として読めませんでした')); };
    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('webp に変換できませんでした'))),
      'image/webp', quality
    );
  });
}

/** この端末で webp を書き出せるか(古い Safari 対策) */
export function canEncodeWebp() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * 長辺を max に収めた webp にする(1枚絵・バナー用)。
 * 元より大きくは引き伸ばさない。
 */
export async function toWebp(file, max = FULL_MAX, quality = 0.9) {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return toBlob(canvas, quality);
}

/**
 * 中央で正方形に切ってから size 角の webp にする(アイコン用)。
 * @param {number} focusY 0〜1。顔が上にあるときは小さめにすると収まりが良い
 */
export async function toIconWebp(file, size = ICON_SIZE, quality = 0.92, focusY = 0.5) {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = Math.max(0, Math.min(img.height - side, (img.height - side) * focusY * 2));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return toBlob(canvas, quality);
}

/** 横長のバナーに整える(はみ出しは中央で切る) */
export async function toBannerWebp(file, width = BANNER_WIDTH, ratio = 16 / 9, quality = 0.88) {
  const img = await loadImage(file);
  const height = Math.round(width / ratio);
  const scale = Math.max(width / img.width, height / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return toBlob(canvas, quality);
}

/** プレビュー用の data URL(保存はしない) */
export function previewUrl(blob) { return URL.createObjectURL(blob); }

/** 「1.2 MB」のように読める大きさ */
export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
