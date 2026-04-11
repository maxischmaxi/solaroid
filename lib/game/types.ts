// Pure data model for Klondike Solitaire.
// No React, no DOM, no side effects.

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Color = "red" | "black";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

// Stable card ID. 52 cards have unique (suit,rank) pairs, so suit-rank is
// collision-free and stable across renders. No UUIDs needed.
export type CardId = `${Suit}-${Rank}`;

export interface Card {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

export type TableauIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type FoundationIndex = 0 | 1 | 2 | 3;

export type PileId =
  | `tableau-${TableauIndex}`
  | `foundation-${FoundationIndex}`
  | "stock"
  | "waste";

export type PileKind = "tableau" | "foundation" | "stock" | "waste";

export interface Pile {
  readonly id: PileId;
  readonly kind: PileKind;
  readonly cards: readonly Card[]; // index 0 = bottom, last = top
}

export type DrawMode = 1 | 3;

export type GameStatus = "idle" | "playing" | "won";

export interface GameState {
  readonly tableau: readonly [Pile, Pile, Pile, Pile, Pile, Pile, Pile];
  readonly foundations: readonly [Pile, Pile, Pile, Pile];
  readonly stock: Pile;
  readonly waste: Pile;
  readonly drawMode: DrawMode;
  readonly stockCycles: number;
  readonly moveCount: number;
  readonly score: number;
  readonly startedAt: number | null;
  readonly status: GameStatus;
  readonly seed: string;
}

// What the UI dispatches. tryApplyMove translates this into a state transition.
export type MoveIntent =
  | { kind: "move"; from: PileId; to: PileId; cardId: CardId }
  | { kind: "draw" }
  | { kind: "recycle" }
  | { kind: "autoMoveToFoundation"; from: PileId };

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };
