// Canvas paint routines for cards. All drawing is into a
// CanvasRenderingContext2D with the origin at (0, 0) of the card box;
// callers translate the context first.

import { colorOf } from "@/lib/game/constants";
import type { Rank, Suit } from "@/lib/game/types";
import { CARD, displayFont, uiFont } from "./palette";
import { PIP_LAYOUTS } from "./pipLayouts";

/* ---------- Glyphs and labels ---------- */

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

/* ---------- Path-based suit drawing (font-independent, always filled) --- */

/**
 * Draw a filled suit symbol centered at (cx, cy).
 * `size` roughly matches the font-size the glyph replaces.
 */
function drawSuitGlyph(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size * 0.45;
  ctx.beginPath();

  switch (suit) {
    case "hearts": {
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 0.1, s * 0.6, -s, s * 0.1, -s, -s * 0.2);
      ctx.bezierCurveTo(-s, -s * 0.65, -s * 0.45, -s * 0.85, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.45, -s * 0.85, s, -s * 0.65, s, -s * 0.2);
      ctx.bezierCurveTo(s, s * 0.1, s * 0.1, s * 0.6, 0, s * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "diamonds": {
      ctx.moveTo(0, -s * 0.9);
      ctx.quadraticCurveTo(s * 0.2, -s * 0.25, s * 0.55, 0);
      ctx.quadraticCurveTo(s * 0.2, s * 0.25, 0, s * 0.9);
      ctx.quadraticCurveTo(-s * 0.2, s * 0.25, -s * 0.55, 0);
      ctx.quadraticCurveTo(-s * 0.2, -s * 0.25, 0, -s * 0.9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "spades": {
      ctx.moveTo(0, -s * 0.85);
      ctx.bezierCurveTo(-s * 0.1, -s * 0.6, -s, -s * 0.1, -s, s * 0.2);
      ctx.bezierCurveTo(-s, s * 0.65, -s * 0.45, s * 0.85, 0, s * 0.45);
      ctx.bezierCurveTo(s * 0.45, s * 0.85, s, s * 0.65, s, s * 0.2);
      ctx.bezierCurveTo(s, -s * 0.1, s * 0.1, -s * 0.6, 0, -s * 0.85);
      ctx.closePath();
      ctx.fill();
      // Stem
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.35);
      ctx.lineTo(s * 0.15, s * 0.35);
      ctx.lineTo(s * 0.25, s * 0.85);
      ctx.lineTo(-s * 0.25, s * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "clubs": {
      const r = s * 0.3;
      ctx.arc(0, -s * 0.35, r, 0, Math.PI * 2);
      ctx.moveTo(-s * 0.38 + r, s * 0.05);
      ctx.arc(-s * 0.38, s * 0.05, r, 0, Math.PI * 2);
      ctx.moveTo(s * 0.38 + r, s * 0.05);
      ctx.arc(s * 0.38, s * 0.05, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      // Stem
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.1);
      ctx.lineTo(s * 0.15, s * 0.1);
      ctx.lineTo(s * 0.2, s * 0.85);
      ctx.lineTo(-s * 0.2, s * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

export const RANK_LABEL: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

/* ---------- Public API ---------- */

/**
 * Paint a card front into ctx. The context's origin should already be at the
 * card's top-left; w/h are the card's pixel dimensions.
 */
export function drawCardFront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  suit: Suit,
  rank: Rank,
): void {
  const fg = colorOf(suit) === "red" ? CARD.red : CARD.black;
  const r = w * 0.06;

  // Drop shadow + ivory card stock
  ctx.save();
  ctx.shadowColor = CARD.cardShadow;
  ctx.shadowBlur = w * 0.1;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = CARD.cardBg;
  ctx.fill();
  ctx.restore();

  // Border ring
  ctx.save();
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = CARD.cardRing;
  ctx.stroke();
  ctx.restore();

  // Clip to the card so artwork doesn't bleed outside the rounded rect.
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();

  // Center artwork (drawn first so corners appear on top for face cards)
  if (rank === 1) {
    drawAceCenter(ctx, w, h, suit, fg);
  } else if (rank >= 11) {
    drawFaceCard(ctx, w, h, suit, rank, fg);
  } else {
    drawPipGrid(ctx, w, h, suit, rank, fg);
  }

  // Corner indices: top-left and bottom-right (rotated 180°)
  drawCornerIndex(ctx, w, h, suit, rank, fg, /* mirror */ false);
  drawCornerIndex(ctx, w, h, suit, rank, fg, /* mirror */ true);

  ctx.restore();
}

/**
 * Paint a card back into ctx: midnight-blue stock, a fine double frame, and
 * the brass sun medallion — the app's signature mark (Solaroid → Sol).
 */
export function drawCardBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const r = w * 0.06;

  // Base gradient
  ctx.save();
  ctx.shadowColor = CARD.cardShadow;
  ctx.shadowBlur = w * 0.1;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, CARD.backFrom);
  grad.addColorStop(1, CARD.backTo);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Fine double frame
  const frame1 = Math.max(1.5, w * 0.055);
  const frame2 = Math.max(3, w * 0.1);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CARD.backFrame;
  roundRect(ctx, frame1, frame1, w - frame1 * 2, h - frame1 * 2, w * 0.045);
  ctx.stroke();
  ctx.strokeStyle = CARD.backFrameInner;
  roundRect(ctx, frame2, frame2, w - frame2 * 2, h - frame2 * 2, w * 0.035);
  ctx.stroke();
  ctx.restore();

  drawSunMedallion(ctx, w / 2, h / 2, w);

  // Four quiet brass dots anchor the corners inside the inner frame.
  const dotInset = frame2 + w * 0.075;
  const dotR = Math.max(0.75, w * 0.016);
  ctx.save();
  ctx.fillStyle = CARD.sunRing;
  for (const [dx, dy] of [
    [dotInset, dotInset],
    [w - dotInset, dotInset],
    [dotInset, h - dotInset],
    [w - dotInset, h - dotInset],
  ]) {
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The brass sun: 16 alternating rays around a warm-lit core disc. */
function drawSunMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
): void {
  const rayLong = w * 0.3;
  const rayShort = w * 0.235;
  const rayBase = w * 0.15;
  const discR = w * 0.115;
  const halo = w * 0.345;

  ctx.save();

  // Thin halo circle framing the rays.
  ctx.beginPath();
  ctx.arc(cx, cy, halo, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = CARD.sunRing;
  ctx.stroke();

  // Rays: slim wedges, long/short alternating for a hand-set rhythm.
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16 - Math.PI / 2;
    const len = i % 2 === 0 ? rayLong : rayShort;
    const halfW = Math.PI / 52;
    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle - halfW) * rayBase,
      cy + Math.sin(angle - halfW) * rayBase,
    );
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.lineTo(
      cx + Math.cos(angle + halfW) * rayBase,
      cy + Math.sin(angle + halfW) * rayBase,
    );
    ctx.closePath();
    ctx.fillStyle = CARD.sun;
    ctx.globalAlpha = i % 2 === 0 ? 0.92 : 0.6;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Core disc with a warm center.
  const core = ctx.createRadialGradient(cx, cy - discR * 0.35, 0, cx, cy, discR);
  core.addColorStop(0, CARD.sunCore);
  core.addColorStop(1, CARD.sun);
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();

  // Inner engraving ring gives the disc depth at larger sizes.
  ctx.beginPath();
  ctx.arc(cx, cy, discR * 0.6, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(21, 41, 77, 0.38)";
  ctx.stroke();

  ctx.restore();
}

/** Empty tableau pile slot. */
export function drawEmptyTableau(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  drawEmptySlot(ctx, w, h);
}

/** Empty stock slot, optionally showing a drawn recycle arrow. */
export function drawEmptyStock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  showRecycle: boolean,
): void {
  drawEmptySlot(ctx, w, h);
  if (showRecycle) {
    drawRecycleArrow(ctx, w / 2, h / 2, w * 0.17);
  }
}

/** Empty foundation slot: a quiet serif "A" marks where the aces go. */
export function drawEmptyFoundation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  drawEmptySlot(ctx, w, h);
  ctx.save();
  ctx.fillStyle = CARD.emptyGlyphSoft;
  ctx.font = `500 ${Math.round(w * 0.38)}px ${displayFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", w / 2, h / 2 + w * 0.02);
  ctx.restore();
}

/* ---------- Internals ---------- */

/** A recess pressed into the felt: darkened fill, soft top shading, thin rim. */
function drawEmptySlot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const r = w * 0.06;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = CARD.emptyBg;
  ctx.fill();

  // Inner shadow along the top edge sells the recess.
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  const shade = ctx.createLinearGradient(0, 0, 0, h * 0.28);
  shade.addColorStop(0, "rgba(0, 8, 4, 0.2)");
  shade.addColorStop(1, "rgba(0, 8, 4, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h * 0.28);
  ctx.restore();

  ctx.save();
  roundRect(ctx, 0.75, 0.75, w - 1.5, h - 1.5, r);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CARD.emptyRing;
  ctx.stroke();
  ctx.restore();
}

/** Circular arrow drawn as a path — crisper than a font-dependent ↻ glyph. */
function drawRecycleArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  const start = -Math.PI * 0.35;
  const end = Math.PI * 1.15;
  ctx.save();
  ctx.strokeStyle = CARD.emptyGlyph;
  ctx.lineWidth = Math.max(1.5, radius * 0.22);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  // Arrow head at the arc's open end.
  const tipAngle = start;
  const tipX = cx + Math.cos(tipAngle) * radius;
  const tipY = cy + Math.sin(tipAngle) * radius;
  const head = radius * 0.55;
  ctx.fillStyle = CARD.emptyGlyph;
  ctx.beginPath();
  ctx.moveTo(tipX + head * 0.62, tipY - head * 0.18);
  ctx.lineTo(tipX - head * 0.38, tipY - head * 0.6);
  ctx.lineTo(tipX - head * 0.28, tipY + head * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCornerIndex(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  suit: Suit,
  rank: Rank,
  fg: string,
  mirror: boolean,
): void {
  const fontPx = Math.round(w * 0.21);
  const padX = w * 0.06;
  const padY = h * 0.04;

  ctx.save();
  if (mirror) {
    // Bottom-right corner, rotated 180° around its anchor.
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  }

  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Rank label (bold)
  ctx.font = `700 ${fontPx}px ${uiFont()}`;
  ctx.fillText(RANK_LABEL[rank], padX, padY);

  // Suit glyph just below the rank, centered under the label
  drawSuitGlyph(ctx, suit, padX + fontPx * 0.35, padY + fontPx * 1.4, fontPx);

  ctx.restore();
}

function drawAceCenter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  suit: Suit,
  fg: string,
): void {
  ctx.save();
  ctx.fillStyle = fg;
  drawSuitGlyph(ctx, suit, w / 2, h / 2, Math.round(w * 0.62));
  ctx.restore();
}

function drawFaceCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  suit: Suit,
  rank: Rank,
  fg: string,
): void {
  // Inset-[18%] gradient box
  const ix = w * 0.18;
  const iy = h * 0.18;
  const iw = w - ix * 2;
  const ih = h - iy * 2;
  const ir = Math.min(iw, ih) * 0.06;

  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, ir);
  const grad = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
  grad.addColorStop(0, CARD.faceBoxFrom);
  grad.addColorStop(1, CARD.faceBoxTo);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CARD.faceBoxRing;
  ctx.stroke();
  ctx.restore();

  // Big serif letter — the engraving-style display face carries the courts.
  ctx.save();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelPx = Math.round(w * 0.42);
  ctx.font = `600 ${labelPx}px ${displayFont()}`;
  // Slightly above the box center to make room for the suit glyph below.
  ctx.fillText(RANK_LABEL[rank], w / 2, iy + ih * 0.4);

  // Suit glyph below
  const glyphPx = Math.round(w * 0.24);
  drawSuitGlyph(ctx, suit, w / 2, iy + ih * 0.74, glyphPx);
  ctx.restore();
}

function drawPipGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  suit: Suit,
  rank: Rank,
  fg: string,
): void {
  const positions = PIP_LAYOUTS[rank];
  if (!positions) return;

  // inset-[14%] inner area
  const ix = w * 0.14;
  const iy = h * 0.14;
  const iw = w - ix * 2;
  const ih = h - iy * 2;
  const pipFontPx = Math.round(w * 0.24);

  ctx.save();
  ctx.fillStyle = fg;

  for (const [cx, cy] of positions) {
    const px = ix + cx * iw;
    const py = iy + cy * ih;
    if (cy > 0.5) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI);
      drawSuitGlyph(ctx, suit, 0, 0, pipFontPx);
      ctx.restore();
    } else {
      drawSuitGlyph(ctx, suit, px, py, pipFontPx);
    }
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  // Use the standard helper if available; otherwise fall back to a manual path.
  const c = ctx as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | DOMPointInit | (number | DOMPointInit)[],
    ) => void;
  };
  ctx.beginPath();
  if (typeof c.roundRect === "function") {
    c.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
