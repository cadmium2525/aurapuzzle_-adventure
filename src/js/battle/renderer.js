/* =========================================================
 * renderer.js — 盤面のCanvas描画
 * 同オーラ同士が「ねっとり」融合して見えるよう、オーブ本体の下に
 * 太い接続帯(ブリッジ)を敷いてから描画する。
 * オーラは色だけでなく形(グリフ)でも区別できるようにしている。
 * =======================================================*/
import { COLORS, COLOR_HEX, COLOR_DARK, COLOR_GLOW } from '../data/gamedata.js';
import { COLS, ROWS } from './board.js';

let canvas, ctx;
export let CELL = 44;

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
}

function applyCellSize() {
  const dpr = window.devicePixelRatio || 1;
  const w = CELL * COLS, h = CELL * ROWS;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * 画面サイズに合わせてセルサイズを決める。
 * まず横幅から仮決めし、縦にはみ出す場合は実測して縮める。
 */
export function resizeBoard() {
  const appEl = document.getElementById('app');
  const appW = appEl.clientWidth || Math.min(440, window.innerWidth);
  const availW = appW - 24 - 16;
  CELL = Math.max(24, Math.min(72, Math.floor(availW / COLS)));
  applyCellSize();

  const mainEl = canvas.closest('main');
  const padBottom = (parseFloat(getComputedStyle(appEl).paddingBottom) || 0)
    + (mainEl ? parseFloat(getComputedStyle(mainEl).paddingBottom) || 0 : 0);
  for (let i = 0; i < 5; i++) {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.height === 0) break;
    const overflow = rect.bottom - (window.innerHeight - padBottom);
    if (overflow <= 0.5) break;
    const next = Math.floor((CELL * ROWS - overflow) / ROWS);
    if (next >= CELL || next < 24) break;
    CELL = next;
    applyCellSize();
  }
}

export function cellCenter(r, c) { return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; }

/* ===================== オーラのグリフ ===================== */
/** 色が見分けにくい環境でもオーラを区別できるよう、形で示す */
function drawGlyph(x, y, radius, colorIndex, alpha) {
  const s = radius * 0.46;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.2, radius * 0.13);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (colorIndex === 0) {            // 火:炎のしずく(上向き)
    ctx.moveTo(x, y - s * 1.15);
    ctx.quadraticCurveTo(x + s, y - s * 0.1, x + s * 0.62, y + s * 0.55);
    ctx.quadraticCurveTo(x, y + s * 1.15, x - s * 0.62, y + s * 0.55);
    ctx.quadraticCurveTo(x - s, y - s * 0.1, x, y - s * 1.15);
    ctx.fill();
  } else if (colorIndex === 1) {     // 水:水滴(下ふくらみ)
    ctx.moveTo(x, y - s * 1.15);
    ctx.quadraticCurveTo(x + s * 0.95, y + s * 0.2, x, y + s * 1.1);
    ctx.quadraticCurveTo(x - s * 0.95, y + s * 0.2, x, y - s * 1.15);
    ctx.fill();
  } else if (colorIndex === 2) {     // 木:木の葉(両端がとがった形)
    ctx.moveTo(x - s, y + s * 0.75);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 1.25, x + s, y - s * 0.75);
    ctx.quadraticCurveTo(x + s * 0.2, y + s * 1.25, x - s, y + s * 0.75);
    ctx.fill();
  } else {                            // 癒:十字
    const a = s * 1.05, b = s * 0.34;
    ctx.rect(x - a, y - b, a * 2, b * 2);
    ctx.rect(x - b, y - a, b * 2, a * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOrb(x, y, radius, colorIndex, opts = {}) {
  const key = COLORS[colorIndex];
  const hex = COLOR_HEX[key], dark = COLOR_DARK[key], glow = COLOR_GLOW[key];
  const { glowing = false, alpha = 1 } = opts;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (glowing) { ctx.shadowColor = hex; ctx.shadowBlur = radius * 0.9; }

  // 本体
  const grad = ctx.createRadialGradient(
    x - radius * 0.34, y - radius * 0.4, radius * 0.12, x, y, radius
  );
  grad.addColorStop(0, glow);
  grad.addColorStop(0.32, hex);
  grad.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  // 縁のリムライト
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.97, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, radius * 0.09);
  ctx.stroke();

  drawGlyph(x, y, radius, colorIndex, 0.55);

  // ハイライト
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.3, y - radius * 0.42, radius * 0.3, radius * 0.17, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();
}

/** 同オーラの隣接オーブを繋ぐ「ねっとり」した帯 */
function drawBridges(board, t, selected, floatPos, dragging) {
  const radius = CELL * 0.42;
  const pulse = 0.5 + 0.5 * Math.sin(t / 520);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const val = board[r][c];
    if (val === -1) continue;
    const isDraggedCell = dragging && selected && selected.r === r && selected.c === c;
    for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
      if (nr >= ROWS || nc >= COLS) continue;
      if (board[nr][nc] !== val) continue;
      const isDraggedNeighbor = dragging && selected && selected.r === nr && selected.c === nc;
      let p1 = cellCenter(r, c), p2 = cellCenter(nr, nc);
      if (isDraggedCell && floatPos) p1 = floatPos;
      if (isDraggedNeighbor && floatPos) p2 = floatPos;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < 1) continue;
      // 離れるほど細く絞れて「引っぱられた粘液」に見せる
      const stretch = Math.min(1, CELL / Math.max(dist, 1));
      const w = radius * (1.42 + 0.10 * pulse) * stretch;
      const key = COLORS[val];
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, COLOR_HEX[key]);
      grad.addColorStop(0.5, COLOR_DARK[key]);
      grad.addColorStop(1, COLOR_HEX[key]);
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.shadowColor = COLOR_HEX[key];
      ctx.shadowBlur = 12 + 6 * pulse;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** 掴んでいるオーブの落下先を示すガイド */
function drawSelectionCell(r, c, t) {
  const x = c * CELL, y = r * CELL;
  const pulse = 0.55 + 0.45 * Math.sin(t / 180);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.35 * pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([CELL * 0.16, CELL * 0.12]);
  ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
  ctx.restore();
}

/**
 * 盤面全体を1フレーム描画する。
 * @param {object} v {board, t, selected, floatPos, dragging, clearingCells, clearT}
 */
export function drawBoard(v) {
  const { board, t, selected, floatPos, dragging, clearingCells, clearT = 0 } = v;
  ctx.clearRect(0, 0, CELL * COLS, CELL * ROWS);

  // 背景の市松模様
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = ((r + c) % 2 === 0) ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.015)';
    ctx.beginPath();
    ctx.roundRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3, CELL * 0.18);
    ctx.fill();
  }

  if (dragging && selected) drawSelectionCell(selected.r, selected.c, t);

  drawBridges(board, t, selected, floatPos, dragging);

  const radius = CELL * 0.42;
  const isClearing = (r, c) => clearingCells.some(([cr, cc]) => cr === r && cc === c);

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const val = board[r][c];
    if (val === -1) continue;
    if (dragging && selected && selected.r === r && selected.c === c) continue;
    const { x, y } = cellCenter(r, c);
    if (isClearing(r, c)) {
      // 消滅アニメ:一度ふくらんでから弾けて消える
      const p = Math.min(1, clearT);
      const scale = 1 + 0.35 * Math.sin(p * Math.PI);
      drawOrb(x, y, radius * scale, val, { glowing: true, alpha: 1 - p * 0.65 });
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 + p * 1.4), 0, Math.PI * 2);
      ctx.strokeStyle = COLOR_GLOW[COLORS[val]];
      ctx.lineWidth = Math.max(1.5, radius * 0.22 * (1 - p));
      ctx.stroke();
      ctx.restore();
    } else {
      drawOrb(x, y, radius, val);
    }
  }

  // ドラッグ中のオーブは最前面
  if (dragging && selected && floatPos) {
    const val = board[selected.r][selected.c];
    ctx.save();
    ctx.beginPath();
    ctx.arc(floatPos.x, floatPos.y, radius * 1.26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    drawOrb(floatPos.x, floatPos.y, radius * 1.12, val, { glowing: true });
  }
}
