// Pure layout calculation: maps a GameState + board dimensions into a
// fully-positioned scene graph. Used by the renderer, hit tester, and the
// scheduler's diff. No side effects, no canvas API references.

import type { DrawMode, GameState, PileId } from "@/lib/game/types";
import type { CardBox, Layout, PileBox, Rect } from "./types";

const CARD_MAX = 92;
// Lowered from 38 → 32 so 320px phones (after safe-area insets) still fit
// the full 7-column tableau. The card art is built from path primitives, so
// it scales cleanly down to ~30px without legibility loss.
const CARD_MIN = 32;
const ASPECT = 1.4; // h = w * 1.4
const PILE_GAP_RATIO = 0.18;
const FAN_DOWN_RATIO = 0.28;
const WASTE_FAN_RATIO = 0.18;

// Height divisor accounts for: top row (1×cardH) + tableauY gap (1.5×pileGap)
// + tableau slot (1×cardH) + 8 face-up fanDown rows + 1×pileGap top padding.
//   = 2.8 + 0.45 + 8×0.28 = 5.49 ≈ 5.5
// Picked to keep a 9-card tableau (typical mid-game depth) fully visible on
// short viewports without clipping the bottom card off the felt.
const HEIGHT_DIVISOR = 5.5;

/**
 * Compute card width given the board dimensions:
 *   - landscape phones:  clamp(40, 0.11 × boardH, 80)
 *   - everything else:   clamp(32, min(boardW/8.44, boardH/5.5), 92)
 *
 * The 8.44 multiplier comes from 7 cards + 6 inter-gaps + 2 edge paddings of
 * 0.18 card-widths each (= 7 + 8 × 0.18). The dual-axis clamp prevents
 * tableau columns from overflowing when the viewport is narrow AND short.
 */
export function computeCardWidth(boardW: number, boardH: number): number {
  if (boardH <= 560 && boardW > boardH) {
    // Landscape-short (phones held sideways): drive sizing from height.
    return clamp(40, 0.11 * boardH, 80);
  }
  const byWidth = boardW / 8.44;
  const byHeight = boardH / HEIGHT_DIVISOR;
  return clamp(CARD_MIN, Math.min(byWidth, byHeight), CARD_MAX);
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the full Layout for a GameState rendered into a board of size
 * (boardW, boardH). Pure function — testable without a canvas.
 */
export function computeLayout(
  game: GameState,
  boardW: number,
  boardH: number,
  drawMode: DrawMode,
): Layout {
  const cardW = computeCardWidth(boardW, boardH);
  const cardH = cardW * ASPECT;
  const pileGap = cardW * PILE_GAP_RATIO;
  const fanDown = cardW * FAN_DOWN_RATIO;

  const colX = (i: number) => pileGap + i * (cardW + pileGap);
  const topRowY = pileGap;
  const tableauY = topRowY + cardH + pileGap * 1.5;

  const piles: Partial<Record<PileId, PileBox>> = {};
  const cardIndex: Record<string, { pileId: PileId; indexInPile: number }> =
    {};

  // ----- Stock (column 0) -----
  piles["stock"] = buildSimplePile(
    "stock",
    game.stock,
    colX(0),
    topRowY,
    cardW,
    cardH,
    cardIndex,
  );

  // ----- Waste (column 1, fanned right by drawMode) -----
  {
    const baseX = colX(1);
    const baseY = topRowY;
    const cards: CardBox[] = [];
    const waste = game.waste.cards;
    const visibleCount = Math.min(drawMode, waste.length);
    const fanStart = waste.length - visibleCount;
    for (let i = 0; i < waste.length; i++) {
      const card = waste[i];
      const offsetIdx = i - fanStart; // negative for hidden, 0..n for visible
      const x = i >= fanStart ? baseX + cardW * WASTE_FAN_RATIO * offsetIdx : baseX;
      cards.push({
        x,
        y: baseY,
        w: cardW,
        h: cardH,
        cardId: card.id,
        faceUp: card.faceUp,
        z: i,
      });
      cardIndex[card.id] = { pileId: "waste", indexInPile: i };
    }
    // Drop rect = the visible fan width.
    const fanW = cardW + cardW * WASTE_FAN_RATIO * Math.max(0, visibleCount - 1);
    piles["waste"] = {
      x: baseX,
      y: baseY,
      w: fanW,
      h: cardH,
      pileId: "waste",
      kind: "waste",
      cards,
      dropRect: { x: baseX, y: baseY, w: fanW, h: cardH },
    };
  }

  // ----- Foundations (columns 3..6) -----
  for (let i = 0; i < 4; i++) {
    const pileId = `foundation-${i}` as PileId;
    piles[pileId] = buildSimplePile(
      pileId,
      game.foundations[i],
      colX(3 + i),
      topRowY,
      cardW,
      cardH,
      cardIndex,
    );
  }

  // ----- Tableau (7 columns, fanned down) -----
  for (let i = 0; i < 7; i++) {
    const pileId = `tableau-${i}` as PileId;
    const pile = game.tableau[i];
    const baseX = colX(i);
    const cards: CardBox[] = [];
    for (let j = 0; j < pile.cards.length; j++) {
      const card = pile.cards[j];
      cards.push({
        x: baseX,
        y: tableauY + fanDown * j,
        w: cardW,
        h: cardH,
        cardId: card.id,
        faceUp: card.faceUp,
        z: j,
      });
      cardIndex[card.id] = { pileId, indexInPile: j };
    }
    // Drop rect spans the full fanned column (slot height + offsets) so
    // dragging onto any visible card lands the drop on the column.
    const dropH =
      cards.length === 0
        ? cardH
        : cardH + Math.max(0, cards.length - 1) * fanDown;
    piles[pileId] = {
      x: baseX,
      y: tableauY,
      w: cardW,
      h: dropH,
      pileId,
      kind: "tableau",
      cards,
      dropRect: { x: baseX, y: tableauY, w: cardW, h: dropH },
    };
  }

  return {
    boardW,
    boardH,
    cardW,
    cardH,
    pileGap,
    fanDown,
    piles: piles as Record<PileId, PileBox>,
    cardIndex: cardIndex as Layout["cardIndex"],
  };
}

/**
 * Stock and foundation piles share the simple "single card slot, top card
 * visible only" layout.
 */
function buildSimplePile(
  pileId: PileId,
  pile: GameState["stock"] | GameState["foundations"][number],
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  cardIndex: Record<string, { pileId: PileId; indexInPile: number }>,
): PileBox {
  const cards: CardBox[] = [];
  for (let i = 0; i < pile.cards.length; i++) {
    const card = pile.cards[i];
    // All cards layered at the same x/y; only the top is visually drawn but
    // the diff needs every card's position so we record them all.
    cards.push({
      x,
      y,
      w: cardW,
      h: cardH,
      cardId: card.id,
      faceUp: card.faceUp,
      z: i,
    });
    cardIndex[card.id] = { pileId, indexInPile: i };
  }
  const rect: Rect = { x, y, w: cardW, h: cardH };
  return {
    ...rect,
    pileId,
    kind: pile.kind,
    cards,
    dropRect: rect,
  };
}
