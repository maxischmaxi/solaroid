import { describe, expect, it } from "vitest";
import { findHint } from "@/lib/game/hints";
import { dealKlondike } from "@/lib/game/deal";
import type {
  Card,
  CardId,
  GameState,
  Pile,
} from "@/lib/game/types";

const card = (
  suit: Card["suit"],
  rank: Card["rank"],
  faceUp = true,
): Card => ({
  id: `${suit}-${rank}` as CardId,
  suit,
  rank,
  faceUp,
});

const tableau = (cards: Card[][]): GameState["tableau"] =>
  cards.map((c, i) => ({
    id: `tableau-${i}` as Pile["id"],
    kind: "tableau" as const,
    cards: c,
  })) as unknown as GameState["tableau"];

const foundations = (
  cards: Card[][],
): GameState["foundations"] =>
  [0, 1, 2, 3].map((i) => ({
    id: `foundation-${i}` as Pile["id"],
    kind: "foundation" as const,
    cards: cards[i] ?? [],
  })) as unknown as GameState["foundations"];

const baseState = (over: Partial<GameState> = {}): GameState => {
  const base = dealKlondike("hint-seed");
  return {
    ...base,
    tableau: tableau([[], [], [], [], [], [], []]),
    foundations: foundations([[], [], [], []]),
    stock: { id: "stock", kind: "stock", cards: [] },
    waste: { id: "waste", kind: "waste", cards: [] },
    ...over,
  };
};

describe("findHint", () => {
  it("returns null when there is nothing to do", () => {
    expect(findHint(baseState())).toBeNull();
  });

  it("prefers a tableau-top → foundation move", () => {
    // tableau-2 has an Ace on top → must go to a foundation.
    const state = baseState({
      tableau: tableau([
        [],
        [],
        [card("hearts", 1)],
        [],
        [],
        [],
        [],
      ]),
      stock: {
        id: "stock",
        kind: "stock",
        cards: [card("clubs", 5, false)],
      },
    });
    const hint = findHint(state);
    expect(hint).toEqual({
      kind: "move",
      from: "tableau-2",
      to: "foundation-0",
      cardId: "hearts-1",
    });
  });

  it("prefers waste-top → foundation when no tableau plays exist", () => {
    const state = baseState({
      waste: {
        id: "waste",
        kind: "waste",
        cards: [card("spades", 1)],
      },
      stock: {
        id: "stock",
        kind: "stock",
        cards: [card("clubs", 5, false)],
      },
    });
    const hint = findHint(state);
    expect(hint).toEqual({
      kind: "move",
      from: "waste",
      to: "foundation-0",
      cardId: "spades-1",
    });
  });

  it("suggests revealing a face-down card via tableau→tableau", () => {
    // tableau-0: [back, K-clubs face-up]  (a K can move to an empty col, revealing the back)
    // tableau-1: empty
    const state = baseState({
      tableau: tableau([
        [card("clubs", 5, false), card("clubs", 13, true)],
        [],
        [],
        [],
        [],
        [],
        [],
      ]),
    });
    const hint = findHint(state);
    expect(hint).toEqual({
      kind: "move",
      from: "tableau-0",
      to: "tableau-1",
      cardId: "clubs-13",
    });
  });

  it("does NOT suggest moving a face-up run that would reveal nothing", () => {
    // tableau-0 has only a single face-up K with no face-down underneath →
    // moving it to tableau-1 reveals nothing, so it should NOT be suggested.
    // The next priority (waste→tableau) also has no candidate. Stock is empty.
    // Therefore the engine should fall through to null (game over).
    const state = baseState({
      tableau: tableau([
        [card("clubs", 13, true)],
        [],
        [],
        [],
        [],
        [],
        [],
      ]),
    });
    expect(findHint(state)).toBeNull();
  });

  it("suggests waste → tableau when no foundation/reveal move exists", () => {
    // Waste top: 5♣ (black). Tableau-0 has 6♥ (red) on top → 5♣ can go there.
    const state = baseState({
      tableau: tableau([
        [card("hearts", 6, true)],
        [],
        [],
        [],
        [],
        [],
        [],
      ]),
      waste: {
        id: "waste",
        kind: "waste",
        cards: [card("clubs", 5, true)],
      },
    });
    const hint = findHint(state);
    expect(hint).toEqual({
      kind: "move",
      from: "waste",
      to: "tableau-0",
      cardId: "clubs-5",
    });
  });

  it("suggests draw when stock has a playable card", () => {
    // Stock contains an Ace (playable to empty foundation) — draw is useful.
    // Stock: [clubs-1 (bottom), hearts-9 (top)]. Draw 1: first draw reveals
    // hearts-9 (not playable), second draw reveals clubs-1 (Ace → foundation).
    const state = baseState({
      stock: {
        id: "stock",
        kind: "stock",
        cards: [card("clubs", 1, false), card("hearts", 9, false)],
      },
    });
    expect(findHint(state)).toEqual({ kind: "stock", action: "draw", draws: 2 });
  });

  it("suggests draw with draws=1 when the top stock card is playable", () => {
    // Stock top is an Ace — one draw suffices.
    const state = baseState({
      stock: {
        id: "stock",
        kind: "stock",
        cards: [card("hearts", 9, false), card("clubs", 1, false)],
      },
    });
    expect(findHint(state)).toEqual({ kind: "stock", action: "draw", draws: 1 });
  });

  it("suggests recycle when stock is empty but waste has a playable card", () => {
    // Waste contains a King (playable to empty tableau) — recycle is useful.
    // Waste: [clubs-13 (bottom), hearts-9 (top)]. After recycle the stock
    // becomes [hearts-9 (bottom), clubs-13 (top)]. Draw 1: clubs-13 (King)
    // is immediately playable. Total: 1 recycle + 1 draw = 2 clicks.
    const state = baseState({
      stock: { id: "stock", kind: "stock", cards: [] },
      waste: {
        id: "waste",
        kind: "waste",
        cards: [card("clubs", 13, true), card("hearts", 9, true)],
      },
      tableau: tableau([[], [], [], [], [], [], []]),
    });
    expect(findHint(state)).toEqual({ kind: "stock", action: "recycle", draws: 2 });
  });

  it("returns null when stock/waste have cards but none are playable", () => {
    // Stock and waste contain mid-rank cards that can't go to empty
    // foundations (need Ace) or empty tableaus (need King). Game is stuck.
    const state = baseState({
      stock: {
        id: "stock",
        kind: "stock",
        cards: [card("clubs", 5, false), card("hearts", 9, false)],
      },
      waste: {
        id: "waste",
        kind: "waste",
        cards: [card("spades", 7, true)],
      },
    });
    expect(findHint(state)).toBeNull();
  });

  it("returns null when stock+waste are empty and no on-board move exists", () => {
    // Two piles, each with [back, red-5]. Both face-up cards are red and
    // there is no black 6 anywhere on the board, no Ace foundation slot
    // accepts them, and stock/waste are empty. Truly stuck.
    const state = baseState({
      tableau: tableau([
        [card("spades", 8, false), card("hearts", 5, true)],
        [card("clubs", 8, false), card("diamonds", 5, true)],
        [],
        [],
        [],
        [],
        [],
      ]),
    });
    expect(findHint(state)).toBeNull();
  });

  it("a fresh deal always has SOME hint (never stuck immediately)", () => {
    // A fresh deal might have a foundation/reveal/etc. move available
    // depending on the shuffle, but it must never return null because the
    // stock is full of 24 cards.
    const hint = findHint(dealKlondike("seed-fresh"));
    expect(hint).not.toBeNull();
  });
});
