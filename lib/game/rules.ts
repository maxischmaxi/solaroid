import { ACE, KING, colorOf } from "./constants";
import type { Card, Pile } from "./types";

function topOf(pile: Pile): Card | null {
  return pile.cards.length === 0 ? null : pile.cards[pile.cards.length - 1];
}

// Can a run of cards (bottom-first) be placed on a tableau pile?
// Empty tableau accepts only a King run; otherwise the bottom of the run must
// be one rank lower than the target top and the opposite color.
export function canPlaceOnTableau(
  moving: readonly Card[],
  target: Pile,
): boolean {
  if (target.kind !== "tableau") return false;
  if (moving.length === 0) return false;
  const bottom = moving[0];
  if (!bottom.faceUp) return false;
  const top = topOf(target);
  if (top === null) return bottom.rank === KING;
  if (!top.faceUp) return false;
  return (
    colorOf(bottom.suit) !== colorOf(top.suit) && bottom.rank === top.rank - 1
  );
}

// A foundation accepts a single card at a time. Empty foundation needs an Ace;
// otherwise same suit, one rank higher than the current top.
export function canPlaceOnFoundation(card: Card, target: Pile): boolean {
  if (target.kind !== "foundation") return false;
  if (!card.faceUp) return false;
  const top = topOf(target);
  if (top === null) return card.rank === ACE;
  return card.suit === top.suit && card.rank === top.rank + 1;
}

// A run is a stack of cards being moved together. It must be face-up,
// strictly descending in rank, and alternating in color.
export function isValidTableauRun(run: readonly Card[]): boolean {
  if (run.length === 0) return false;
  for (let i = 0; i < run.length; i++) {
    if (!run[i].faceUp) return false;
    if (i > 0) {
      const prev = run[i - 1];
      const curr = run[i];
      if (curr.rank !== prev.rank - 1) return false;
      if (colorOf(curr.suit) === colorOf(prev.suit)) return false;
    }
  }
  return true;
}

// Locate a card by id in a pile and return the run starting at it (that card
// plus everything stacked on top of it). Returns null if the card is not in
// the pile or if the resulting run is not a valid tableau run.
export function runStartingAt(
  pile: Pile,
  cardId: Card["id"],
): readonly Card[] | null {
  const idx = pile.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return null;
  const run = pile.cards.slice(idx);
  if (pile.kind === "tableau" && !isValidTableauRun(run)) return null;
  return run;
}

export function topCardOf(pile: Pile): Card | null {
  return topOf(pile);
}
