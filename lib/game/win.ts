import type { GameState } from "./types";

export function isWon(state: GameState): boolean {
  return state.foundations.every((f) => f.cards.length === 13);
}

export function allTableauFaceUp(state: GameState): boolean {
  return state.tableau.every((pile) => pile.cards.every((c) => c.faceUp));
}

// Eligible to auto-complete: no face-down cards remain in the tableau and the
// game is not yet won. From this point on every card's location is known —
// the stock can be cycled freely, so the outcome is decided. Stock and waste
// do NOT need to be empty; the auto-completer will draw and recycle as needed.
export function canAutoComplete(state: GameState): boolean {
  return !isWon(state) && allTableauFaceUp(state);
}
