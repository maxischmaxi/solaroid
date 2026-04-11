import { describe, expect, it } from "vitest";
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  isValidTableauRun,
} from "@/lib/game/rules";
import type { Card, Pile } from "@/lib/game/types";

function card(suit: Card["suit"], rank: Card["rank"], faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp };
}

function tableauPile(cards: Card[] = []): Pile {
  return { id: "tableau-0", kind: "tableau", cards };
}

function foundationPile(cards: Card[] = []): Pile {
  return { id: "foundation-0", kind: "foundation", cards };
}

describe("canPlaceOnTableau", () => {
  it("allows King on empty tableau", () => {
    expect(canPlaceOnTableau([card("spades", 13)], tableauPile([]))).toBe(true);
  });

  it("rejects Queen on empty tableau", () => {
    expect(canPlaceOnTableau([card("spades", 12)], tableauPile([]))).toBe(false);
  });

  it("allows red 6 on black 7", () => {
    expect(
      canPlaceOnTableau([card("hearts", 6)], tableauPile([card("spades", 7)])),
    ).toBe(true);
  });

  it("rejects red 6 on red 7 (same color)", () => {
    expect(
      canPlaceOnTableau(
        [card("hearts", 6)],
        tableauPile([card("diamonds", 7)]),
      ),
    ).toBe(false);
  });

  it("rejects red 6 on black 8 (rank gap)", () => {
    expect(
      canPlaceOnTableau([card("hearts", 6)], tableauPile([card("spades", 8)])),
    ).toBe(false);
  });

  it("rejects placing on a face-down top card", () => {
    expect(
      canPlaceOnTableau(
        [card("hearts", 6)],
        tableauPile([card("spades", 7, false)]),
      ),
    ).toBe(false);
  });

  it("rejects an empty run", () => {
    expect(canPlaceOnTableau([], tableauPile([]))).toBe(false);
  });
});

describe("canPlaceOnFoundation", () => {
  it("accepts an Ace on empty foundation", () => {
    expect(canPlaceOnFoundation(card("hearts", 1), foundationPile([]))).toBe(true);
  });

  it("rejects 2 of Hearts on empty foundation", () => {
    expect(canPlaceOnFoundation(card("hearts", 2), foundationPile([]))).toBe(false);
  });

  it("accepts 2 of Hearts on Ace of Hearts", () => {
    expect(
      canPlaceOnFoundation(
        card("hearts", 2),
        foundationPile([card("hearts", 1)]),
      ),
    ).toBe(true);
  });

  it("rejects 2 of Hearts on Ace of Spades (wrong suit)", () => {
    expect(
      canPlaceOnFoundation(
        card("hearts", 2),
        foundationPile([card("spades", 1)]),
      ),
    ).toBe(false);
  });

  it("rejects 3 of Hearts on Ace of Hearts (rank gap)", () => {
    expect(
      canPlaceOnFoundation(
        card("hearts", 3),
        foundationPile([card("hearts", 1)]),
      ),
    ).toBe(false);
  });

  it("rejects face-down card", () => {
    expect(
      canPlaceOnFoundation(card("hearts", 1, false), foundationPile([])),
    ).toBe(false);
  });
});

describe("isValidTableauRun", () => {
  it("accepts a single face-up card", () => {
    expect(isValidTableauRun([card("hearts", 5)])).toBe(true);
  });

  it("accepts a descending alternating-color run", () => {
    expect(
      isValidTableauRun([
        card("spades", 7),
        card("hearts", 6),
        card("clubs", 5),
        card("diamonds", 4),
      ]),
    ).toBe(true);
  });

  it("rejects same-color sequence", () => {
    expect(
      isValidTableauRun([card("spades", 7), card("clubs", 6)]),
    ).toBe(false);
  });

  it("rejects rank gap", () => {
    expect(
      isValidTableauRun([card("spades", 7), card("hearts", 5)]),
    ).toBe(false);
  });

  it("rejects face-down card in the middle", () => {
    expect(
      isValidTableauRun([
        card("spades", 7),
        card("hearts", 6, false),
        card("clubs", 5),
      ]),
    ).toBe(false);
  });

  it("rejects empty run", () => {
    expect(isValidTableauRun([])).toBe(false);
  });
});
