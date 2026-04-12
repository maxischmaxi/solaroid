// Heuristic winnability checker. Uses the hint engine's greedy strategy to
// simulate an entire game from the initial deal. If the greedy solver wins,
// the deal is certainly winnable. (Some winnable deals require non-greedy
// play and will be missed — that's fine for a "winnable" game mode.)

import { dealKlondike } from "./deal";
import { findHint, type Hint } from "./hints";
import { tryApplyMove } from "./moves";
import { randomSeed } from "./rng";
import type { DrawMode, GameState, MoveIntent } from "./types";
import { isWon } from "./win";

function hintToIntent(hint: Hint): MoveIntent {
  if (hint.kind === "move") {
    return { kind: "move", from: hint.from, to: hint.to, cardId: hint.cardId };
  }
  return hint.action === "draw" ? { kind: "draw" } : { kind: "recycle" };
}

/**
 * Run the hint-based greedy solver on a deal. Returns true if the solver
 * reaches a won state within the move limit.
 */
export function isGreedyWinnable(state: GameState): boolean {
  const MOVE_LIMIT = 500;
  let cur = state;
  for (let i = 0; i < MOVE_LIMIT; i++) {
    if (isWon(cur)) return true;
    const hint = findHint(cur);
    if (!hint) return false;
    const intent = hintToIntent(hint);
    const result = tryApplyMove(cur, intent);
    if (!result.ok) return false;
    cur = result.state;
  }
  return isWon(cur);
}

/**
 * Find a winnable seed by trying random deals with the greedy solver.
 * Returns the seed string, or null if no winnable deal is found within
 * the attempt limit (very unlikely for draw-1, rare for draw-3).
 */
export function findWinnableSeed(
  drawMode: DrawMode,
  maxAttempts = 200,
): string | null {
  for (let i = 0; i < maxAttempts; i++) {
    const seed = randomSeed();
    const game = dealKlondike(seed, drawMode);
    if (isGreedyWinnable(game)) return seed;
  }
  return null;
}

/**
 * Deterministic daily seed. Everyone playing on the same date with the same
 * draw mode gets the same deal.
 */
export function dailySeed(drawMode: DrawMode): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `daily-${yyyy}-${mm}-${dd}-draw${drawMode}`;
}
