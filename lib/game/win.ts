import type { GameState } from "./types";

export function isWon(state: GameState): boolean {
  return state.foundations.every((f) => f.cards.length === 13);
}

export function allTableauFaceUp(state: GameState): boolean {
  return state.tableau.every((pile) => pile.cards.every((c) => c.faceUp));
}

// Eligible to auto-complete: every tableau card is face-up AND the stock and
// waste are empty. From this position the rest is purely mechanical.
export function canAutoComplete(state: GameState): boolean {
  return (
    !isWon(state) &&
    state.stock.cards.length === 0 &&
    state.waste.cards.length === 0 &&
    allTableauFaceUp(state)
  );
}
