// Canvas paint routines for cards, mirroring the original DOM Card.tsx 1:1.
// All drawing is into a CanvasRenderingContext2D with the origin at (0, 0)
// of the card box; callers translate the context first.

import { colorOf } from "@/lib/game/constants";
import type { Rank, Suit } from "@/lib/game/types";
import { getActiveTheme } from "@/lib/theme/activeTheme";
import { PIP_LAYOUTS } from "./pipLayouts";

/* ---------- Glyphs and labels ---------- */

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
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

/* ---------- Color palette + fonts — read from active theme ---------- */

function pal() {
  return getActiveTheme().card;
}

function fontStack() {
  return getActiveTheme().fonts.primary;
}

function serifStack() {
  return getActiveTheme().fonts.serif;
}

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
  const p = pal();
  const fg = colorOf(suit) === "red" ? p.red : p.black;
  const r = w * 0.06;

  // Drop shadow + base card
  ctx.save();
  ctx.shadowColor = p.cardShadow;
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = p.cardBg;
  ctx.fill();
  ctx.restore();

  // Border ring
  ctx.save();
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.cardRing;
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

/** Paint a card back into ctx. */
export function drawCardBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const p = pal();
  const r = w * 0.06;

  // Base gradient
  ctx.save();
  ctx.shadowColor = p.cardShadow;
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, p.backFrom);
  grad.addColorStop(1, p.backTo);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Inner inset-1 area with diagonal stripes
  const inset = Math.max(1, Math.round(w * 0.025));
  const innerR = w * 0.045;
  const innerX = inset;
  const innerY = inset;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;

  ctx.save();
  roundRect(ctx, innerX, innerY, innerW, innerH, innerR);
  ctx.clip();

  // Stripe A: 45°
  drawDiagonalStripes(
    ctx,
    innerX,
    innerY,
    innerW,
    innerH,
    /* angle deg */ 45,
    p.backStripeA,
    /* stripeW */ Math.max(2, w * 0.045),
    /* gapW */ Math.max(3, w * 0.067),
  );
  // Stripe B: -45°
  drawDiagonalStripes(
    ctx,
    innerX,
    innerY,
    innerW,
    innerH,
    /* angle deg */ -45,
    p.backStripeB,
    Math.max(2, w * 0.045),
    Math.max(3, w * 0.067),
  );
  ctx.restore();

  // Inner ring
  ctx.save();
  roundRect(ctx, innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1, innerR);
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.backInnerRing;
  ctx.stroke();
  ctx.restore();
}

/** Empty tableau pile slot (dashed outline). */
export function drawEmptyTableau(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  drawEmptySlot(ctx, w, h);
}

/** Empty stock slot, optionally showing the recycle ↻ glyph. */
export function drawEmptyStock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  showRecycle: boolean,
): void {
  drawEmptySlot(ctx, w, h);
  if (showRecycle) {
    ctx.save();
    ctx.fillStyle = pal().emptyHintStock;
    ctx.font = `${Math.round(w * 0.4)}px ${fontStack()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u21BB", w / 2, h / 2);
    ctx.restore();
  }
}

/** Empty foundation slot (dashed outline + ♢ glyph). */
export function drawEmptyFoundation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  drawEmptySlot(ctx, w, h);
  ctx.save();
  ctx.fillStyle = pal().emptyHintFoundation;
  ctx.font = `${Math.round(w * 0.4)}px ${fontStack()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2662", w / 2, h / 2);
  ctx.restore();
}

/* ---------- Internals ---------- */

function drawEmptySlot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const p = pal();
  const r = w * 0.06;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = p.emptyBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = p.emptyDash;
  ctx.stroke();
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
  ctx.font = `bold ${fontPx}px ${fontStack()}`;
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
  const p = pal();
  grad.addColorStop(0, p.faceBoxFrom);
  grad.addColorStop(1, p.faceBoxTo);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.faceBoxRing;
  ctx.stroke();
  ctx.restore();

  // Big serif label
  ctx.save();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelPx = Math.round(w * 0.42);
  ctx.font = `600 ${labelPx}px ${serifStack()}`;
  // Slightly above the box center to make room for the suit glyph below.
  ctx.fillText(RANK_LABEL[rank], w / 2, iy + ih * 0.40);

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

  // inset-[14%] inner area (the original Card.tsx wraps pips in this box)
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

/**
 * Draw repeating diagonal lines across a rectangle. The caller is expected to
 * have set up a clip region beforehand.
 */
function drawDiagonalStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleDeg: number,
  color: string,
  stripeW: number,
  gapW: number,
): void {
  const period = stripeW + gapW;
  const angle = (angleDeg * Math.PI) / 180;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  // After rotation we work in a coordinate system aligned with the stripes.
  // The diagonal of the rect bounds how far we need to draw to cover the box.
  const diag = Math.ceil(Math.sqrt(w * w + h * h)) + period;
  ctx.fillStyle = color;
  for (let s = -diag; s < diag; s += period) {
    ctx.fillRect(-diag, s, diag * 2, stripeW);
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
