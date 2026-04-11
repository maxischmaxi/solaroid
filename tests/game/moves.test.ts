import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { tryApplyMove } from "@/lib/game/moves";
import { drawFromStock } from "@/lib/game/stock";
import type { CardId, GameState, Pile } from "@/lib/game/types";

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error("expected ok, got " + JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
}

// Build a deterministic state we can poke at by hand.
function withState(patch: (s: GameState) => GameState): GameState {
  return patch(dealKlondike("test-seed", 1));
}

describe("tryApplyMove — illegal moves", () => {
  it("rejects an unknown source pile", () => {
    const state = dealKlondike("seed-1");
    const r = tryApplyMove(state, {
      kind: "move",
      from: "tableau-9" as Pile["id"],
      to: "tableau-0",
      cardId: "spades-1",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects moving a card that is not in the source pile", () => {
    const state = dealKlondike("seed-1");
    const r = tryApplyMove(state, {
      kind: "move",
      from: "tableau-0",
      to: "tableau-1",
      cardId: "clubs-2" as CardId,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects moving the stock pile directly", () => {
    const state = dealKlondike("seed-1");
    const r = tryApplyMove(state, {
      kind: "move",
      from: "stock",
      to: "tableau-0",
      cardId: state.stock.cards[state.stock.cards.length - 1].id,
    });
    expect(r.ok).toBe(false);
  });
});

describe("tryApplyMove — tableau to foundation", () => {
  it("moves a card and applies +10 score", () => {
    // Build a state where we know the top of tableau-0 is an Ace.
    const state = withState((s) => {
      const ace = { id: "spades-1" as CardId, suit: "spades" as const, rank: 1 as const, faceUp: true };
      const newPile: Pile = { id: "tableau-0", kind: "tableau", cards: [ace] };
      const arr = Array.from(s.tableau);
      arr[0] = newPile;
      return { ...s, tableau: arr as unknown as GameState["tableau"] };
    });
    const r = ok(
      tryApplyMove(state, {
        kind: "move",
        from: "tableau-0",
        to: "foundation-0",
        cardId: "spades-1",
      }),
    );
    expect(r.state.foundations[0].cards).toHaveLength(1);
    expect(r.state.tableau[0].cards).toHaveLength(0);
    expect(r.state.score).toBe(10);
    expect(r.state.moveCount).toBe(1);
  });

  it("auto-flips the next tableau card and grants +5 reveal bonus", () => {
    const state = withState((s) => {
      const hidden = { id: "hearts-9" as CardId, suit: "hearts" as const, rank: 9 as const, faceUp: false };
      const top = { id: "spades-1" as CardId, suit: "spades" as const, rank: 1 as const, faceUp: true };
      const newPile: Pile = { id: "tableau-0", kind: "tableau", cards: [hidden, top] };
      const arr = Array.from(s.tableau);
      arr[0] = newPile;
      return { ...s, tableau: arr as unknown as GameState["tableau"] };
    });
    const r = ok(
      tryApplyMove(state, {
        kind: "move",
        from: "tableau-0",
        to: "foundation-0",
        cardId: "spades-1",
      }),
    );
    // 10 (waste→foundation? no, tableau→foundation = 10) + 5 (reveal) = 15
    expect(r.state.score).toBe(15);
    expect(r.state.tableau[0].cards[0].faceUp).toBe(true);
  });
});

describe("tryApplyMove — foundation to tableau", () => {
  it("applies -15 score", () => {
    const state = withState((s) => {
      const king = { id: "spades-13" as CardId, suit: "spades" as const, rank: 13 as const, faceUp: true };
      const queenRed = { id: "hearts-12" as CardId, suit: "hearts" as const, rank: 12 as const, faceUp: true };
      const found: Pile = { id: "foundation-0", kind: "foundation", cards: [queenRed] };
      const tab: Pile = { id: "tableau-0", kind: "tableau", cards: [king] };
      const tabArr = Array.from(s.tableau);
      tabArr[0] = tab;
      const fArr = Array.from(s.foundations);
      fArr[0] = found;
      return {
        ...s,
        tableau: tabArr as unknown as GameState["tableau"],
        foundations: fArr as unknown as GameState["foundations"],
      };
    });
    const r = ok(
      tryApplyMove(state, {
        kind: "move",
        from: "foundation-0",
        to: "tableau-0",
        cardId: "hearts-12",
      }),
    );
    expect(r.state.score).toBe(-15);
  });
});

describe("tryApplyMove — auto move to foundation", () => {
  it("succeeds when source top can go to a foundation", () => {
    const state = withState((s) => {
      const ace = { id: "spades-1" as CardId, suit: "spades" as const, rank: 1 as const, faceUp: true };
      const wastePile: Pile = { id: "waste", kind: "waste", cards: [ace] };
      return { ...s, waste: wastePile };
    });
    const r = ok(tryApplyMove(state, { kind: "autoMoveToFoundation", from: "waste" }));
    expect(r.state.waste.cards).toHaveLength(0);
    expect(r.state.foundations.some((f) => f.cards.length === 1)).toBe(true);
  });

  it("fails when there is no legal foundation", () => {
    const state = withState((s) => {
      const five = { id: "spades-5" as CardId, suit: "spades" as const, rank: 5 as const, faceUp: true };
      return { ...s, waste: { id: "waste", kind: "waste", cards: [five] } };
    });
    const r = tryApplyMove(state, { kind: "autoMoveToFoundation", from: "waste" });
    expect(r.ok).toBe(false);
  });
});

describe("tryApplyMove — draw / recycle dispatch", () => {
  it("dispatches draw intent to drawFromStock", () => {
    const state = dealKlondike("seed-1", 1);
    const r = ok(tryApplyMove(state, { kind: "draw" }));
    expect(r.state.waste.cards).toHaveLength(1);
  });

  it("dispatches recycle intent", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    const r = ok(tryApplyMove(state, { kind: "recycle" }));
    expect(r.state.stock.cards).toHaveLength(24);
    expect(r.state.waste.cards).toHaveLength(0);
  });
});
