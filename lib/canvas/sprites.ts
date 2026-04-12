// Pre-render all 52 card faces, the back, and the three empty-slot variants
// into offscreen canvases. This is the most expensive paint work (text, pips,
// gradients) and we do it once per cardW×dpr combo, then blit on every frame.

import { SUITS, RANKS } from "@/lib/game/constants";
import type { CardId, Rank, Suit, ThemeId } from "@/lib/game/types";
import {
  drawCardBack,
  drawCardFront,
  drawEmptyFoundation,
  drawEmptyStock,
  drawEmptyTableau,
} from "./drawCard";

export interface SpriteCache {
  faces: Map<CardId, HTMLCanvasElement>;
  back: HTMLCanvasElement;
  emptyTableau: HTMLCanvasElement;
  emptyStockRecycle: HTMLCanvasElement;
  emptyFoundation: HTMLCanvasElement;
  cardW: number;
  cardH: number;
  dpr: number;
  themeId: ThemeId;
}

/**
 * Build a fresh sprite cache for the given visual card size and device pixel
 * ratio. Each sprite is sized at (cardW × dpr) physical pixels for crispness;
 * the sprite's internal context is pre-scaled by dpr so drawCard.ts can use
 * logical coordinates throughout.
 */
export function buildSprites(
  cardW: number,
  cardH: number,
  dpr: number,
  themeId: ThemeId,
): SpriteCache {
  const faces = new Map<CardId, HTMLCanvasElement>();

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const id = `${suit}-${rank}` as CardId;
      faces.set(id, makeFaceSprite(suit, rank, cardW, cardH, dpr));
    }
  }

  return {
    faces,
    back: makeSprite(cardW, cardH, dpr, (ctx) =>
      drawCardBack(ctx, cardW, cardH),
    ),
    emptyTableau: makeSprite(cardW, cardH, dpr, (ctx) =>
      drawEmptyTableau(ctx, cardW, cardH),
    ),
    emptyStockRecycle: makeSprite(cardW, cardH, dpr, (ctx) =>
      drawEmptyStock(ctx, cardW, cardH, /* showRecycle */ true),
    ),
    emptyFoundation: makeSprite(cardW, cardH, dpr, (ctx) =>
      drawEmptyFoundation(ctx, cardW, cardH),
    ),
    cardW,
    cardH,
    dpr,
    themeId,
  };
}

function makeFaceSprite(
  suit: Suit,
  rank: Rank,
  cardW: number,
  cardH: number,
  dpr: number,
): HTMLCanvasElement {
  return makeSprite(cardW, cardH, dpr, (ctx) =>
    drawCardFront(ctx, cardW, cardH, suit, rank),
  );
}

interface SpriteMeta {
  _margin?: number;
  _logicalW?: number;
  _logicalH?: number;
}

function makeSprite(
  cardW: number,
  cardH: number,
  dpr: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // We render with a small bleed margin so that the drop shadow drawn inside
  // drawCardFront isn't clipped at the sprite edges.
  const margin = Math.ceil(cardW * 0.18);
  const logicalW = cardW + margin * 2;
  const logicalH = cardH + margin * 2;
  canvas.width = Math.ceil(logicalW * dpr);
  canvas.height = Math.ceil(logicalH * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  ctx.translate(margin, margin);
  paint(ctx);
  const meta = canvas as HTMLCanvasElement & SpriteMeta;
  meta._margin = margin;
  meta._logicalW = logicalW;
  meta._logicalH = logicalH;
  return canvas;
}

/** Look up the visual margin baked into a sprite (for drawImage offset). */
export function spriteMargin(sprite: HTMLCanvasElement): number {
  return (sprite as HTMLCanvasElement & SpriteMeta)._margin ?? 0;
}

/** Look up the logical (CSS-pixel) dimensions baked into a sprite. */
export function spriteLogicalSize(
  sprite: HTMLCanvasElement,
): { w: number; h: number } {
  const m = sprite as HTMLCanvasElement & SpriteMeta;
  return {
    w: m._logicalW ?? sprite.width,
    h: m._logicalH ?? sprite.height,
  };
}
