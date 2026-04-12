import { tryApplyMove } from "./moves";
import { topCardOf } from "./rules";
import type { Card, GameState, MoveIntent, PileId } from "./types";
import { canAutoComplete, isWon } from "./win";

function findFoundationFor(state: GameState, card: Card): PileId | null {
  for (let i = 0; i < state.foundations.length; i++) {
    const f = state.foundations[i];
    const fTop = topCardOf(f);
    const okEmpty = fTop === null && card.rank === 1;
    const okBuild =
      fTop !== null && fTop.suit === card.suit && card.rank === fTop.rank + 1;
    if (okEmpty || okBuild) return `foundation-${i}` as PileId;
  }
  return null;
}

// Pick the next move toward auto-complete. With every tableau card already
// face-up, the strategy is purely greedy:
//   1. Play the lowest-rank top (tableau or waste) that has a foundation slot.
//   2. If no foundation move exists, draw the next card from stock.
//   3. If stock is empty but waste still has cards, recycle the waste.
// The caller is responsible for detecting "stuck" cycles where draws/recycles
// fail to surface a playable card.
export function pickNextAutoMove(state: GameState): MoveIntent | null {
  if (isWon(state)) return null;

  // Collect every "top" we could move to a foundation.
  const candidates: { from: PileId; card: Card }[] = [];
  for (const pile of state.tableau) {
    const top = topCardOf(pile);
    if (top && top.faceUp) candidates.push({ from: pile.id, card: top });
  }
  const wasteTop = topCardOf(state.waste);
  if (wasteTop && wasteTop.faceUp) {
    candidates.push({ from: state.waste.id, card: wasteTop });
  }

  // Lowest rank wins; ties broken by iteration order.
  let best: { from: PileId; card: Card; foundation: PileId } | null = null;
  for (const cand of candidates) {
    if (best && cand.card.rank >= best.card.rank) continue;
    const foundation = findFoundationFor(state, cand.card);
    if (foundation) {
      best = { from: cand.from, card: cand.card, foundation };
    }
  }

  if (best) {
    return {
      kind: "move",
      from: best.from,
      to: best.foundation,
      cardId: best.card.id,
    };
  }

  // No foundation move available — try to surface a new waste top.
  if (state.stock.cards.length > 0) {
    return { kind: "draw" };
  }
  if (state.waste.cards.length > 0) {
    return { kind: "recycle" };
  }
  return null;
}

// Compute the full sequence of moves that finishes the game from the current
// state. Used by tests and by the autoplay sequencer for stagger pacing.
// Bails if the greedy strategy stalls (e.g. draw-3 ordering with no playable
// waste top through a complete cycle).
export function planAutoComplete(state: GameState): MoveIntent[] {
  if (!canAutoComplete(state)) return [];
  const out: MoveIntent[] = [];
  let cur = state;
  let progressedSinceLastRecycle = true;
  // Hard cap: enough room for 52 foundation plays plus draws + a couple of
  // recycles in the worst case.
  const HARD_CAP = 52 * 4;
  for (let i = 0; i < HARD_CAP && !isWon(cur); i++) {
    const intent = pickNextAutoMove(cur);
    if (!intent) break;
    if (intent.kind === "recycle" && !progressedSinceLastRecycle) break;
    const before = totalFoundationCards(cur);
    const result = tryApplyMove(cur, intent);
    if (!result.ok) break;
    out.push(intent);
    cur = result.state;
    if (totalFoundationCards(cur) > before) {
      progressedSinceLastRecycle = true;
    } else if (intent.kind === "recycle") {
      progressedSinceLastRecycle = false;
    }
  }
  return out;
}

function totalFoundationCards(state: GameState): number {
  return state.foundations.reduce((sum, f) => sum + f.cards.length, 0);
}
