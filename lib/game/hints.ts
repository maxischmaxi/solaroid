// Hint engine: pick the single most useful action the player could take
// from the current state. The Tipp button calls findHint and either shows
// the result as a canvas animation or — when nothing is left — surfaces a
// "game over" dialog.
//
// Pure data in, pure data out. The animation layer turns the result into
// pixels; the store turns a `null` return into the game-over flag.

import { canPlaceOnFoundation, canPlaceOnTableau, topCardOf } from "./rules";
import type { CardId, GameState, PileId } from "./types";

export type Hint =
  | { kind: "move"; from: PileId; to: PileId; cardId: CardId }
  | { kind: "stock"; action: "draw" | "recycle"; draws: number };

/**
 * Return the recommended next action, or `null` if the player is truly
 * stuck (no legal move and nothing left in stock or waste).
 *
 * Priority order, highest first:
 *   1. Tableau-top → Foundation
 *   2. Waste-top  → Foundation
 *   3. Tableau-run → Tableau that flips a face-down card underneath
 *   4. Waste-top  → Tableau
 *   5. Draw   (stock has cards)
 *   6. Recycle (stock empty, waste non-empty)
 */
export function findHint(state: GameState): Hint | null {
  // 1. Any tableau top → foundation
  for (const pile of state.tableau) {
    const top = topCardOf(pile);
    if (!top || !top.faceUp) continue;
    for (let i = 0; i < state.foundations.length; i++) {
      if (canPlaceOnFoundation(top, state.foundations[i])) {
        return {
          kind: "move",
          from: pile.id,
          to: `foundation-${i}` as PileId,
          cardId: top.id,
        };
      }
    }
  }

  // 2. Waste top → foundation
  const wasteTop = topCardOf(state.waste);
  if (wasteTop && wasteTop.faceUp) {
    for (let i = 0; i < state.foundations.length; i++) {
      if (canPlaceOnFoundation(wasteTop, state.foundations[i])) {
        return {
          kind: "move",
          from: state.waste.id,
          to: `foundation-${i}` as PileId,
          cardId: wasteTop.id,
        };
      }
    }
  }

  // 3. Tableau-run → Tableau that reveals a face-down card.
  // The only revealing move is to relocate the ENTIRE bottom-most face-up
  // run, which exposes the (face-down) card underneath. Splitting the run
  // would leave a face-up card behind and reveal nothing.
  for (const src of state.tableau) {
    const idx = src.cards.findIndex((c) => c.faceUp);
    if (idx <= 0) continue; // -1 = empty pile, 0 = nothing to reveal
    const run = src.cards.slice(idx);
    for (const dst of state.tableau) {
      if (dst.id === src.id) continue;
      if (canPlaceOnTableau(run, dst)) {
        return {
          kind: "move",
          from: src.id,
          to: dst.id,
          cardId: run[0].id,
        };
      }
    }
  }

  // 4. Waste top → Tableau
  if (wasteTop && wasteTop.faceUp) {
    for (const dst of state.tableau) {
      if (canPlaceOnTableau([wasteTop], dst)) {
        return {
          kind: "move",
          from: state.waste.id,
          to: dst.id,
          cardId: wasteTop.id,
        };
      }
    }
  }

  // 5/6. Draw or recycle — but only if at least one card in the combined
  // stock + waste pool can actually be placed on a foundation or tableau.
  // If none can, cycling through the stock is pointless and the game is stuck.
  if (state.stock.cards.length > 0 || state.waste.cards.length > 0) {
    const draws = countClicksToPlayable(state);
    if (draws > 0) {
      if (state.stock.cards.length > 0) {
        return { kind: "stock", action: "draw", draws };
      }
      return { kind: "stock", action: "recycle", draws };
    }
  }

  // 7. Truly stuck.
  return null;
}

/**
 * Simulate drawing through the stock (and recycling if necessary) to find
 * how many clicks on the stock pile it takes to reach the first playable
 * card. Returns 0 if no card is reachable (game is stuck).
 */
function countClicksToPlayable(state: GameState): number {
  const { drawMode } = state;
  let stockCards = state.stock.cards.slice();
  let wasteCards = state.waste.cards.slice();
  let clicks = 0;
  let recycled = false;

  // Safety: at most one full pass through stock + one recycle + one more pass.
  const maxClicks = stockCards.length + wasteCards.length + 2;

  while (clicks < maxClicks) {
    if (stockCards.length === 0) {
      if (wasteCards.length === 0 || recycled) break;
      // Recycle: waste reverses into stock.
      stockCards = wasteCards.slice().reverse();
      wasteCards = [];
      clicks++;
      recycled = true;
      continue;
    }

    // Draw min(drawMode, remaining) cards from the top of stock.
    const count = Math.min(drawMode, stockCards.length);
    const drawn: typeof stockCards = [];
    for (let i = 0; i < count; i++) {
      drawn.push(stockCards.pop()!);
    }
    wasteCards = wasteCards.concat(drawn);
    clicks++;

    // The waste top (last element) is the newly accessible card.
    const top = wasteCards[wasteCards.length - 1];
    const c = top.faceUp ? top : { ...top, faceUp: true as const };
    for (const f of state.foundations) {
      if (canPlaceOnFoundation(c, f)) return clicks;
    }
    for (const t of state.tableau) {
      if (canPlaceOnTableau([c], t)) return clicks;
    }
  }

  return 0; // stuck
}
