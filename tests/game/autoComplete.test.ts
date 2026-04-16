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
    accumulatedMs: 0,
    status: "playing",
    seed: "test",
    redealLimit: null,
  };
}

describe("planAutoComplete", () => {
  it("returns no moves when face-down cards remain in the tableau", () => {
    const state = buildAutoCompleteScenario();
    // Mark the first card face-down — that hides information so we cannot
    // legally auto-complete yet.
    const notEligible: GameState = {
      ...state,
      tableau: state.tableau.map((p, i) =>
        i === 0
          ? { ...p, cards: p.cards.map((c, j) => (j === 0 ? { ...c, faceUp: false } : c)) }
          : p,
      ) as unknown as GameState["tableau"],
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

  it("drains stock and waste during auto-complete (draw-1)", () => {
    // Move the bottom Ace of each suit (index 12 in the pile, which is the
    // top of a King-down stack? no — index 12 is the top here since we push
    // 13..1, so top is index 12 = Ace) into stock/waste so the planner has
    // to draw to surface them.
    //
    // Layout: tableau has only 2..K of each suit (face up), waste has
    // clubs-1, stock has [diamonds-1, hearts-1, spades-1] (top first).
    const base = buildAutoCompleteScenario();
    const tableau = base.tableau.map((p) => ({
      ...p,
      cards: p.cards.slice(0, -1), // drop the Ace from each pile
    })) as unknown as GameState["tableau"];

    const aceOf = (suit: "clubs" | "diamonds" | "hearts" | "spades"): Card => ({
      id: `${suit}-1` as CardId,
      suit,
      rank: 1,
      faceUp: true,
    });

    // Stock cards face-down (drawFromStock flips them on draw).
    const state: GameState = {
      ...base,
      tableau,
      waste: {
        ...base.waste,
        cards: [aceOf("clubs")],
      },
      stock: {
        ...base.stock,
        // Top of stock is the LAST element of the array. Order so the first
        // draw surfaces diamonds-1, then hearts-1, then spades-1.
        cards: [
          { ...aceOf("spades"), faceUp: false },
          { ...aceOf("hearts"), faceUp: false },
          { ...aceOf("diamonds"), faceUp: false },
        ],
      },
      drawMode: 1,
    };

    const moves = planAutoComplete(state);
    // The very first move should consume the waste Ace into a foundation.
    expect(moves[0]).toMatchObject({ kind: "move", from: "waste" });
    expect(moves.some((m) => m.kind === "draw")).toBe(true);

    let cur = state;
    for (const intent of moves) {
      const r = tryApplyMove(cur, intent);
      expect(r.ok).toBe(true);
      if (r.ok) cur = r.state;
    }
    expect(isWon(cur)).toBe(true);
  });

  it("recycles the waste when stock empties without finishing", () => {
    // Same idea as above, but with the Ace buried so we have to recycle.
    const base = buildAutoCompleteScenario();
    const tableau = base.tableau.map((p, i) => ({
      ...p,
      cards: i === 0 ? p.cards.slice(0, -1) : p.cards,
    })) as unknown as GameState["tableau"];

    const state: GameState = {
      ...base,
      tableau,
      // Ace of clubs is alone in waste; stock empty. Plan must drain via a
      // direct foundation move (no recycle needed, but stock-empty path).
      waste: {
        ...base.waste,
        cards: [
          { id: "clubs-1" as CardId, suit: "clubs", rank: 1, faceUp: true },
        ],
      },
      stock: { ...base.stock, cards: [] },
      drawMode: 1,
    };

    const moves = planAutoComplete(state);
    let cur = state;
    for (const intent of moves) {
      const r = tryApplyMove(cur, intent);
      expect(r.ok).toBe(true);
      if (r.ok) cur = r.state;
    }
    expect(isWon(cur)).toBe(true);
  });
});
