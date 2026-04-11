import type { Card, Pile } from "./types";

// If the top card of a tableau pile is face-down, return a new pile with that
// card flipped face-up. Other pile kinds are unaffected.
export function flipTopIfNeeded(pile: Pile): {
  pile: Pile;
  flipped: Card | null;
} {
  if (pile.kind !== "tableau") return { pile, flipped: null };
  if (pile.cards.length === 0) return { pile, flipped: null };
  const top = pile.cards[pile.cards.length - 1];
  if (top.faceUp) return { pile, flipped: null };
  const newTop: Card = { ...top, faceUp: true };
  const newCards = pile.cards.slice(0, -1).concat(newTop);
  return { pile: { ...pile, cards: newCards }, flipped: newTop };
}
