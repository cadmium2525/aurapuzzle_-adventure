/* =========================================================
 * renderer.js — 盤面のCanvas描画
 * 同色オーブ同士が「ねっとり」と融合して見えるよう、
 * オーブ本体の下に太い接続帯(ブリッジ)を敷いてから描画する。
 * =======================================================*/
import { COLORS, COLOR_HEX, COLOR_DARK, HEAL_COLOR } from '../data/gamedata.js';
import { COLS, ROWS } from './board.js';

let canvas, ctx;
export let CELL = 52;

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
}

/** 画面サイズに合わせてセルサイズを決め、Canvasを再構成する */
export function resizeBoard() {
  const wrap = canvas.parentElement;
  const availW = (wrap.clientWidth || 360) - 16;
  // 盤面より上のUI(敵/味方/タイマー)ぶんを差し引いた高さ予算
  const availH = Math.max(180, window.innerHeight * 0.40);
  CELL = Math.floor(Math.min(availW / COLS, availH / ROWS));
  CELL = Math.max(38, Math.min(72, CELL));

  const dpr = window.devicePixelRatio || 1;
  const w = CELL * COLS, h = CELL * ROWS;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function cellCenter(r, c) { return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; }

function drawOrb(x, y, radius, colorKey, glow) {
  const hex = COLOR_HEX[colorKey], dark = COLOR_DARK[colorKey];
  ctx.save();
  if (glow) { ctx.shadowColor = hex; ctx.shadowBlur = 20; }
  const grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, hex);
  grad.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  // ハイライト
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.32, y - radius * 0.42, radius * 0.28, radius * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  // 回復オーラには十字マークを重ねて役割を示す
  if (colorKey === COLORS[HEAL_COLOR]) {
    const a = radius * 0.34, b = radius * 0.12;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x - a, y - b, a * 2, b * 2);
    ctx.fillRect(x - b, y - a, b * 2, a * 2);
    ctx.restore();
  }
}

/**
 * 同色の隣接オーブを繋ぐ「ねっとり」した帯を描く。
 * 太めのカプセルを敷いた上にオーブを重ねるとメタボール状に融合して見える。
 */
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
      const hex = COLOR_HEX[key], dark = COLOR_DARK[key];
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, hex);
      grad.addColorStop(0.5, dark);
      grad.addColorStop(1, hex);
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.shadowColor = hex;
      ctx.shadowBlur = 12 + 6 * pulse;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * 盤面全体を1フレーム描画する。
 * @param {object} v 描画に必要な状態
 */
export function drawBoard(v) {
  const { board, t, selected, floatPos, dragging, clearingCells } = v;
  ctx.clearRect(0, 0, CELL * COLS, CELL * ROWS);

  // 背景の市松模様
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = ((r + c) % 2 === 0) ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
  }

  drawBridges(board, t, selected, floatPos, dragging);

  const radius = CELL * 0.42;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const val = board[r][c];
    if (val === -1) continue;
    if (dragging && selected && selected.r === r && selected.c === c) continue;
    const { x, y } = cellCenter(r, c);
    const isClearing = clearingCells.some(([cr, cc]) => cr === r && cc === c);
    if (isClearing) {
      drawOrb(x, y, radius * 1.12, COLORS[val], true);
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    } else {
      drawOrb(x, y, radius, COLORS[val], false);
    }
  }

  // ドラッグ中のオーブは最前面
  if (dragging && selected && floatPos) {
    const val = board[selected.r][selected.c];
    ctx.beginPath();
    ctx.arc(floatPos.x, floatPos.y, radius * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawOrb(floatPos.x, floatPos.y, radius * 1.12, COLORS[val], true);
  }
}
