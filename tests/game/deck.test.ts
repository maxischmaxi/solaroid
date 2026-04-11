import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "@/lib/game/deck";
import { mulberry32, seedFromString } from "@/lib/game/rng";

describe("createDeck", () => {
  it("returns 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it("includes all 13 ranks of all 4 suits", () => {
    const deck = createDeck();
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
      for (let r = 1; r <= 13; r++) {
        expect(deck.some((c) => c.suit === suit && c.rank === r)).toBe(true);
      }
    }
  });

  it("creates all cards face-down", () => {
    const deck = createDeck();
    expect(deck.every((c) => c.faceUp === false)).toBe(true);
  });
});

describe("shuffle", () => {
  it("is a permutation (round-trip via id sort)", () => {
    const deck = createDeck();
    const rand = mulberry32(seedFromString("test"));
    const shuffled = shuffle(deck, rand);
    expect(shuffled).toHaveLength(52);
    const a = deck.map((c) => c.id).sort();
    const b = shuffled.map((c) => c.id).sort();
    expect(b).toEqual(a);
  });

  it("is deterministic for the same seed", () => {
    const deck = createDeck();
    const a = shuffle(deck, mulberry32(seedFromString("seed-A")));
    const b = shuffle(deck, mulberry32(seedFromString("seed-A")));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("differs across different seeds (smoke)", () => {
    const deck = createDeck();
    const a = shuffle(deck, mulberry32(seedFromString("seed-A")));
    const b = shuffle(deck, mulberry32(seedFromString("seed-B")));
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
  });

  it("does not mutate the input", () => {
    const deck = createDeck();
    const before = deck.map((c) => c.id);
    shuffle(deck, mulberry32(1));
    expect(deck.map((c) => c.id)).toEqual(before);
  });
});
