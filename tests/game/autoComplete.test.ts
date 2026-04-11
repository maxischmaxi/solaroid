import { describe, expect, it } from "vitest";
import { planAutoComplete } from "@/lib/game/autoComplete";
import { tryApplyMove } from "@/lib/game/moves";
import { isWon } from "@/lib/game/win";
import type { Card, CardId, GameState, Pile, Suit } from "@/lib/game/types";

function suitOrder(): Suit[] {
  return ["clubs", "diamonds", "hearts", "spades"];
}

// Build a state where all 52 cards are face-up across 4 tableau piles
// (one per suit, King at bottom, Ace on top), so the greedy auto-complete
// can immediately play Aces, then 2s, etc.
function buildAutoCompleteScenario(): GameState {
  const piles: Card[][] = [[], [], [], [], [], [], []];
  suitOrder().forEach((suit, pileIdx) => {
    for (let r = 13 as const; r >= 1; r--) {
      piles[pileIdx].push({
        id: `${suit}-${r as 1}` as CardId,
        suit,
        rank: r as 1,
        faceUp: true,
      });
    }
  });
  return {
    tableau: piles.map((cards, i) => ({
      id: `tableau-${i}` as Pile["id"],
      kind: "tableau",
      cards,
    })) as unknown as GameState["tableau"],
    foundations: [
      { id: "foundation-0", kind: "foundation", cards: [] },
      { id: "foundation-1", kind: "foundation", cards: [] },
      { id: "foundation-2", kind: "foundation", cards: [] },
      { id: "foundation-3", kind: "foundation", cards: [] },
    ] as unknown as GameState["foundations"],
    stock: { id: "stock", kind: "stock", cards: [] },
    waste: { id: "waste", kind: "waste", cards: [] },
    drawMode: 1,
    stockCycles: 0,
    moveCount: 0,
    score: 0,
    startedAt: null,
    status: "playing",
    seed: "test",
  };
}

describe("planAutoComplete", () => {
  it("returns no moves on a non-eligible state", () => {
    const state = buildAutoCompleteScenario();
    // Add a card to waste so it's not eligible.
    const notEligible: GameState = {
      ...state,
      waste: {
        ...state.waste,
        cards: [{ id: "clubs-1" as CardId, suit: "clubs", rank: 1, faceUp: true }],
      },
    };
    expect(planAutoComplete(notEligible)).toEqual([]);
  });

  it("plans exactly 52 moves and ends in a won state", () => {
    const state = buildAutoCompleteScenario();
    const moves = planAutoComplete(state);
    expect(moves).toHaveLength(52);

    // Apply them sequentially and confirm we win.
    let cur = state;
    for (const intent of moves) {
      const r = tryApplyMove(cur, intent);
      expect(r.ok).toBe(true);
      if (r.ok) cur = r.state;
    }
    expect(isWon(cur)).toBe(true);
  });

  it("picks the lowest available rank first", () => {
    const state = buildAutoCompleteScenario();
    const moves = planAutoComplete(state);
    // The first 4 moves must all be Aces (one per suit).
    const firstFourRanks = moves.slice(0, 4).map((m) => {
      if (m.kind !== "move") throw new Error("expected move");
      return m.cardId;
    });
    expect(firstFourRanks.every((id) => id.endsWith("-1"))).toBe(true);
  });
});
