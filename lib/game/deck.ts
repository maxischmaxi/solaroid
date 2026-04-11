import { RANKS, SUITS } from "./constants";
import type { Card, CardId } from "./types";

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}` as CardId,
        suit,
        rank,
        faceUp: false,
      });
    }
  }
  return deck;
}

// Pure Fisher-Yates. Returns a new array; does not mutate input.
export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
