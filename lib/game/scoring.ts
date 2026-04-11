import { SCORE } from "./constants";
import type { DrawMode, Pile, PileKind } from "./types";

// Score delta for a single move from one pile kind to another.
export function moveScoreDelta(from: PileKind, to: PileKind): number {
  if (from === "waste" && to === "tableau") return SCORE.WASTE_TO_TABLEAU;
  if (from === "waste" && to === "foundation") return SCORE.WASTE_TO_FOUNDATION;
  if (from === "tableau" && to === "foundation")
    return SCORE.TABLEAU_TO_FOUNDATION;
  if (from === "foundation" && to === "tableau")
    return SCORE.FOUNDATION_TO_TABLEAU;
  return 0;
}

export function recyclePenalty(drawMode: DrawMode): number {
  return drawMode === 1 ? SCORE.RECYCLE_DRAW_1 : SCORE.RECYCLE_DRAW_3;
}

export function flipReveal(): number {
  return SCORE.TURN_OVER_TABLEAU;
}

// Microsoft Klondike time bonus, applied on win.
// bonus = floor(700_000 / elapsedSeconds) - 7 * elapsedSeconds, clamped >= 0.
export function timeBonus(elapsedMs: number): number {
  const sec = Math.max(1, Math.floor(elapsedMs / 1000));
  const raw = Math.floor(700_000 / sec) - 7 * sec;
  return Math.max(0, raw);
}

// Convenience for tests / UI: total at end of game.
export function finalScore(score: number, elapsedMs: number): number {
  return score + timeBonus(elapsedMs);
}

// Re-export for callers that import from this module:
export { SCORE };
export type { Pile };
