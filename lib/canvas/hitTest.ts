// Pure hit testing: maps a (x, y) pointer position into a HitTarget
// (clickable card / interactive pile) or a drop target during drag.
//
// Both functions are pure — no DOM, no canvas.

import type { HitTarget, Layout, PileBox, Rect } from "./types";
import type { PileId } from "@/lib/game/types";

/**
 * Determine what the user is interacting with at (x, y).
 *
 * Returns:
 *   - { kind: 'card', ... } when the point hits a face-up card
 *   - { kind: 'pile', pileId } when the point hits the stock pile (which is
 *     interactive on click but doesn't expose individual cards)
 *   - { kind: 'none' } otherwise
 *
 * Empty piles return 'none' here — they're drop targets, not click sources.
 */
export function hitTest(layout: Layout, x: number, y: number): HitTarget {
  for (const pile of Object.values(layout.piles)) {
    if (!rectContains(pile.dropRect, x, y)) continue;

    switch (pile.kind) {
      case "stock":
        // Stock is always click-interactive (draw or recycle), even when empty.
        return { kind: "pile", pileId: pile.pileId };

      case "waste": {
        // Only the top face-up card is interactive; the entire fan rect maps
        // back to it (matches the original DOM behavior where non-top fan
        // cards weren't clickable).
        const top = pile.cards[pile.cards.length - 1];
        if (!top || !top.faceUp) return { kind: "none" };
        return {
          kind: "card",
          pileId: pile.pileId,
          cardId: top.cardId,
          indexInPile: pile.cards.length - 1,
        };
      }

      case "foundation": {
        const top = pile.cards[pile.cards.length - 1];
        if (!top) return { kind: "none" };
        return {
          kind: "card",
          pileId: pile.pileId,
          cardId: top.cardId,
          indexInPile: pile.cards.length - 1,
        };
      }

      case "tableau": {
        // Walk top→bottom. Each non-top card has a strip-shaped hit area
        // (only the visible band above the next card).
        const result = pickTableauCard(pile, x, y, layout.fanDown);
        if (result) return result;
        return { kind: "none" };
      }
    }
  }
  return { kind: "none" };
}

/**
 * Determine which pile (if any) is a valid drop target at (x, y) during drag.
 *
 * Stock and waste are never drop targets — only tableaus and foundations.
 */
export function dropTest(layout: Layout, x: number, y: number): PileId | null {
  for (const pile of Object.values(layout.piles)) {
    if (pile.kind !== "tableau" && pile.kind !== "foundation") continue;
    if (rectContains(pile.dropRect, x, y)) return pile.pileId;
  }
  return null;
}

function pickTableauCard(
  pile: PileBox,
  x: number,
  y: number,
  fanDown: number,
): HitTarget | null {
  if (pile.cards.length === 0) return null;
  const last = pile.cards.length - 1;

  // Walk from top to bottom and pick the first card whose strip contains the
  // point. The topmost card uses its full bounding box; deeper cards use only
  // the visible vertical band of size `fanDown`.
  for (let i = last; i >= 0; i--) {
    const c = pile.cards[i];
    if (!c.faceUp) continue;
    const stripH = i === last ? c.h : fanDown;
    if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + stripH) {
      return {
        kind: "card",
        pileId: pile.pileId,
        cardId: c.cardId,
        indexInPile: i,
      };
    }
  }
  return null;
}

function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
