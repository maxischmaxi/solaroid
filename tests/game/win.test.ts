import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { allTableauFaceUp, canAutoComplete, isWon } from "@/lib/game/win";
import type { CardId, GameState, Pile } from "@/lib/game/types";

function emptyTableau(): Pile[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    id: `tableau-${i}` as Pile["id"],
    kind: "tableau" as const,
    cards: [],
  }));
}

function fillFoundationsCompletely(state: GameState): GameState {
  const foundations = (["clubs", "diamonds", "hearts", "spades"] as const).map(
    (suit, fi) => ({
      id: `foundation-${fi}` as Pile["id"],
      kind: "foundation" as const,
      cards: Array.from({ length: 13 }, (_, i) => ({
        id: `${suit}-${(i + 1) as 1}` as CardId,
        suit,
        rank: (i + 1) as 1,
        faceUp: true,
      })),
    }),
  );
  return {
    ...state,
    foundations: foundations as unknown as GameState["foundations"],
  };
}

describe("isWon", () => {
  it("returns false for a fresh deal", () => {
    expect(isWon(dealKlondike("seed-1"))).toBe(false);
  });
  it("returns true when all 4 foundations have 13 cards", () => {
    const state = fillFoundationsCompletely(dealKlondike("seed-1"));
    expect(isWon(state)).toBe(true);
  });
});

describe("allTableauFaceUp", () => {
  it("is false on a fresh deal", () => {
    expect(allTableauFaceUp(dealKlondike("seed-1"))).toBe(false);
  });
  it("is true when every tableau card is face-up", () => {
    const state = dealKlondike("seed-1");
    const flipped: GameState["tableau"] = state.tableau.map((p) => ({
      ...p,
      cards: p.cards.map((c) => ({ ...c, faceUp: true })),
    })) as unknown as GameState["tableau"];
    expect(allTableauFaceUp({ ...state, tableau: flipped })).toBe(true);
  });
});

describe("canAutoComplete", () => {
  it("requires stock + waste empty AND all tableau face-up AND not yet won", () => {
    const base = dealKlondike("seed-1");
    const t = emptyTableau() as unknown as GameState["tableau"];
    const ready: GameState = {
      ...base,
      tableau: t,
      stock: { ...base.stock, cards: [] },
      waste: { ...base.waste, cards: [] },
    };
    expect(canAutoComplete(ready)).toBe(true);
  });

  it("is false when waste is non-empty", () => {
    const base = dealKlondike("seed-1");
    const t = emptyTableau() as unknown as GameState["tableau"];
    const notReady: GameState = {
      ...base,
      tableau: t,
      stock: { ...base.stock, cards: [] },
      waste: {
        ...base.waste,
        cards: [
          { id: "spades-5" as CardId, suit: "spades", rank: 5, faceUp: true },
        ],
      },
    };
    expect(canAutoComplete(notReady)).toBe(false);
  });

  it("is false when game is already won", () => {
    const base = dealKlondike("seed-1");
    const won = fillFoundationsCompletely({
      ...base,
      stock: { ...base.stock, cards: [] },
      tableau: emptyTableau() as unknown as GameState["tableau"],
    });
    expect(canAutoComplete(won)).toBe(false);
  });
});
