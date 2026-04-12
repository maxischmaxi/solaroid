// Canvas paint routines for cards, mirroring the original DOM Card.tsx 1:1.
// All drawing is into a CanvasRenderingContext2D with the origin at (0, 0)
// of the card box; callers translate the context first.

import { colorOf } from "@/lib/game/constants";
import type { Rank, Suit } from "@/lib/game/types";
import { PIP_LAYOUTS } from "./pipLayouts";

/* ---------- Glyphs and labels ---------- */

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

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

/* ---------- Color palette (matches Tailwind classes used previously) ---------- */

const COLOR = {
  white: "#ffffff",
  cardRing: "rgba(0,0,0,0.15)",
  faceBoxRing: "rgba(0,0,0,0.10)",
  red: "#e11d48", // rose-600
  black: "#18181b", // zinc-900
  // Back gradient (sky-700 → sky-900)
  backFrom: "#0369a1",
  backTo: "#0c4a6e",
  backInnerRing: "rgba(255,255,255,0.30)",
  backStripeA: "rgba(255,255,255,0.16)",
  backStripeB: "rgba(255,255,255,0.12)",
  // Face card center box (zinc-50 → zinc-200)
  faceBoxFrom: "#fafafa",
  faceBoxTo: "#e4e4e7",
  // Empty pile placeholders
  emptyBg: "rgba(255,255,255,0.04)",
  emptyDash: "rgba(255,255,255,0.18)",
  emptyHintStock: "rgba(255,255,255,0.50)",
  emptyHintFoundation: "rgba(255,255,255,0.30)",
};

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SERIF_STACK =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

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
  const fg = colorOf(suit) === "red" ? COLOR.red : COLOR.black;
  const r = w * 0.06;

  // Drop shadow + base white card
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = COLOR.white;
  ctx.fill();
  ctx.restore();

  // Border ring
  ctx.save();
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.cardRing;
  ctx.stroke();
  ctx.restore();

  // Clip to the card so artwork doesn't bleed outside the rounded rect.
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();

  // Corner indices: top-left and bottom-right (rotated 180°)
  drawCornerIndex(ctx, w, h, suit, rank, fg, /* mirror */ false);
  drawCornerIndex(ctx, w, h, suit, rank, fg, /* mirror */ true);

  // Center artwork
  if (rank === 1) {
    drawAceCenter(ctx, w, h, suit, fg);
  } else if (rank >= 11) {
    drawFaceCard(ctx, w, h, suit, rank, fg);
  } else {
    drawPipGrid(ctx, w, h, suit, rank, fg);
  }

  ctx.restore();
}

/** Paint a card back into ctx. */
export function drawCardBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const r = w * 0.06;

  // Base gradient
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.20)";
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.03;
  roundRect(ctx, 0, 0, w, h, r);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, COLOR.backFrom);
  grad.addColorStop(1, COLOR.backTo);
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
    COLOR.backStripeA,
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
    COLOR.backStripeB,
    Math.max(2, w * 0.045),
    Math.max(3, w * 0.067),
  );
  ctx.restore();

  // Inner ring (white/30)
  ctx.save();
  roundRect(ctx, innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1, innerR);
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.backInnerRing;
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
    ctx.fillStyle = COLOR.emptyHintStock;
    ctx.font = `${Math.round(w * 0.4)}px ${FONT_STACK}`;
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
  ctx.fillStyle = COLOR.emptyHintFoundation;
  ctx.font = `${Math.round(w * 0.4)}px ${FONT_STACK}`;
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
  const r = w * 0.06;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = COLOR.emptyBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = COLOR.emptyDash;
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
  ctx.font = `bold ${fontPx}px ${FONT_STACK}`;
  ctx.fillText(RANK_LABEL[rank], padX, padY);

  // Suit glyph just below the rank, leading-none ≈ 0.95 * fontPx
  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.fillText(SUIT_GLYPH[suit], padX, padY + fontPx * 0.95);

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
  ctx.font = `${Math.round(w * 0.62)}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(SUIT_GLYPH[suit], w / 2, h / 2);
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
  grad.addColorStop(0, COLOR.faceBoxFrom);
  grad.addColorStop(1, COLOR.faceBoxTo);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.faceBoxRing;
  ctx.stroke();
  ctx.restore();

  // Big serif label
  ctx.save();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelPx = Math.round(w * 0.42);
  ctx.font = `600 ${labelPx}px ${SERIF_STACK}`;
  // Slightly above the box center to make room for the suit glyph below.
  ctx.fillText(RANK_LABEL[rank], w / 2, iy + ih * 0.40);

  // Suit glyph below
  const glyphPx = Math.round(w * 0.24);
  ctx.font = `${glyphPx}px ${FONT_STACK}`;
  ctx.fillText(SUIT_GLYPH[suit], w / 2, iy + ih * 0.74);
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
  ctx.font = `${pipFontPx}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const [cx, cy] of positions) {
    const px = ix + cx * iw;
    const py = iy + cy * ih;
    if (cy > 0.5) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI);
      ctx.fillText(SUIT_GLYPH[suit], 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(SUIT_GLYPH[suit], px, py);
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
