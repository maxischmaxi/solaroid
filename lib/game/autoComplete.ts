import { tryApplyMove } from "./moves";
import { topCardOf } from "./rules";
import type { GameState, MoveIntent, Pile, PileId } from "./types";
import { canAutoComplete, isWon } from "./win";

// Pick the next move toward auto-complete. From an "all face-up, no stock/waste"
// position the lowest-rank tableau top that can go to its foundation always works.
export function pickNextAutoMove(state: GameState): MoveIntent | null {
  if (isWon(state)) return null;

  // Find the lowest-rank tableau top that has a legal foundation destination.
  let best: { pile: Pile; rank: number } | null = null;
  for (const pile of state.tableau) {
    const top = topCardOf(pile);
    if (!top || !top.faceUp) continue;
    if (best && top.rank >= best.rank) continue;
    // Check legality: any foundation that accepts it?
    for (let i = 0; i < state.foundations.length; i++) {
      const f = state.foundations[i];
      const fTop = topCardOf(f);
      const okEmpty = fTop === null && top.rank === 1;
      const okBuild = fTop !== null && fTop.suit === top.suit && top.rank === fTop.rank + 1;
      if (okEmpty || okBuild) {
        best = { pile, rank: top.rank };
        break;
      }
    }
  }

  if (!best) return null;
  const top = topCardOf(best.pile)!;

  // Find the matching foundation explicitly.
  let target: PileId | null = null;
  for (let i = 0; i < state.foundations.length; i++) {
    const f = state.foundations[i];
    const fTop = topCardOf(f);
    if ((fTop === null && top.rank === 1) || (fTop !== null && fTop.suit === top.suit && top.rank === fTop.rank + 1)) {
      target = `foundation-${i}` as PileId;
      break;
    }
  }
  if (!target) return null;

  return { kind: "move", from: best.pile.id, to: target, cardId: top.id };
}

// Compute the full sequence of moves that finishes the game from the current
// state. Used by tests and by the autoplay sequencer for stagger pacing.
export function planAutoComplete(state: GameState): MoveIntent[] {
  if (!canAutoComplete(state)) return [];
  const out: MoveIntent[] = [];
  let cur = state;
  // Hard cap: at most 52 moves.
  for (let i = 0; i < 52 && !isWon(cur); i++) {
    const intent = pickNextAutoMove(cur);
    if (!intent) break;
    const result = tryApplyMove(cur, intent);
    if (!result.ok) break;
    out.push(intent);
    cur = result.state;
  }
  return out;
}
