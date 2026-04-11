import type { Color, Rank, Suit } from "./types";

export const SUITS: readonly Suit[] = [
  "clubs",
  "diamonds",
  "hearts",
  "spades",
] as const;

export const RANKS: readonly Rank[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
] as const;

export const ACE: Rank = 1;
export const KING: Rank = 13;

export function colorOf(suit: Suit): Color {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

// Standard Windows Klondike scoring table.
export const SCORE = {
  WASTE_TO_TABLEAU: 5,
  WASTE_TO_FOUNDATION: 10,
  TABLEAU_TO_FOUNDATION: 10,
  TURN_OVER_TABLEAU: 5,
  FOUNDATION_TO_TABLEAU: -15,
  RECYCLE_DRAW_1: -100,
  RECYCLE_DRAW_3: -20,
} as const;
