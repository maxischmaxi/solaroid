import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { drawFromStock, recycleWaste } from "@/lib/game/stock";

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error("expected ok");
  return r as Extract<T, { ok: true }>;
}

describe("drawFromStock — Draw 1", () => {
  it("moves one card from stock to waste, face-up", () => {
    let state = dealKlondike("seed-1", 1);
    const before = state.stock.cards.length;
    state = ok(drawFromStock(state)).state;
    expect(state.stock.cards).toHaveLength(before - 1);
    expect(state.waste.cards).toHaveLength(1);
    expect(state.waste.cards[0].faceUp).toBe(true);
  });

  it("emptying the stock takes exactly 24 draws", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) {
      state = ok(drawFromStock(state)).state;
    }
    expect(state.stock.cards).toHaveLength(0);
    expect(state.waste.cards).toHaveLength(24);
  });

  it("rejects draw when stock is empty", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    expect(drawFromStock(state).ok).toBe(false);
  });

  it("transitions status from idle to playing on first draw", () => {
    let state = dealKlondike("seed-1", 1);
    expect(state.status).toBe("idle");
    state = ok(drawFromStock(state)).state;
    expect(state.status).toBe("playing");
    expect(state.startedAt).toBeTypeOf("number");
  });
});

describe("drawFromStock — Draw 3", () => {
  it("moves three cards on a normal draw", () => {
    let state = dealKlondike("seed-1", 3);
    state = ok(drawFromStock(state)).state;
    expect(state.waste.cards).toHaveLength(3);
    expect(state.waste.cards.every((c) => c.faceUp)).toBe(true);
  });

  it("the most recently drawn card (deepest in stock-top-3) is on top of the waste", () => {
    let state = dealKlondike("seed-1", 3);
    const len = state.stock.cards.length;
    // The 3 cards drawn are stock[len-1], stock[len-2], stock[len-3] in that order.
    // The LAST drawn (= stock[len-3]) ends up on top of the waste.
    const expectedTop = state.stock.cards[len - 3];
    state = ok(drawFromStock(state)).state;
    expect(state.waste.cards[state.waste.cards.length - 1].id).toBe(expectedTop.id);
  });

  it("draws fewer than 3 if the stock has less", () => {
    let state = dealKlondike("seed-1", 3);
    // Draw seven full draws (21 cards), leaving 3 in stock.
    for (let i = 0; i < 7; i++) state = ok(drawFromStock(state)).state;
    expect(state.stock.cards).toHaveLength(3);
    state = ok(drawFromStock(state)).state;
    expect(state.stock.cards).toHaveLength(0);
    expect(state.waste.cards).toHaveLength(24);
  });
});

describe("recycleWaste", () => {
  it("rejects when stock is non-empty", () => {
    const state = dealKlondike("seed-1", 1);
    expect(recycleWaste(state).ok).toBe(false);
  });

  it("rejects when waste is also empty", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    state = { ...state, waste: { ...state.waste, cards: [] } };
    expect(recycleWaste(state).ok).toBe(false);
  });

  it("flips waste back to stock face-down, in reversed order", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    const wasteOrder = state.waste.cards.map((c) => c.id);
    state = ok(recycleWaste(state)).state;
    expect(state.waste.cards).toHaveLength(0);
    expect(state.stock.cards).toHaveLength(24);
    expect(state.stock.cards.every((c) => c.faceUp === false)).toBe(true);
    // Stock is reversed waste: stock top should be the original bottom of waste.
    const stockReversed = state.stock.cards.slice().reverse().map((c) => c.id);
    expect(stockReversed).toEqual(wasteOrder);
  });

  it("increments stockCycles and applies the Draw 1 penalty (-100)", () => {
    let state = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    const scoreBefore = state.score;
    state = ok(recycleWaste(state)).state;
    expect(state.stockCycles).toBe(1);
    expect(state.score).toBe(scoreBefore - 100);
  });

  it("applies the Draw 3 penalty (-20)", () => {
    let state = dealKlondike("seed-1", 3);
    for (let i = 0; i < 8; i++) state = ok(drawFromStock(state)).state;
    expect(state.stock.cards).toHaveLength(0);
    const scoreBefore = state.score;
    state = ok(recycleWaste(state)).state;
    expect(state.score).toBe(scoreBefore - 20);
  });

  it("rejects when the redeal limit is reached", () => {
    // redealLimit = 2 → first two recycles allowed, third one blocked.
    let state = dealKlondike("seed-1", 1, 2);
    for (let cycle = 0; cycle < 2; cycle++) {
      for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
      state = ok(recycleWaste(state)).state;
    }
    expect(state.stockCycles).toBe(2);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    const res = recycleWaste(state);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("redeal-limit-reached");
  });

  it("blocks the very first recycle when redealLimit = 0 (Vegas)", () => {
    let state = dealKlondike("seed-1", 1, 0);
    for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
    const res = recycleWaste(state);
    expect(res.ok).toBe(false);
  });

  it("allows unlimited recycles when redealLimit is null", () => {
    let state = dealKlondike("seed-1", 1, null);
    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < 24; i++) state = ok(drawFromStock(state)).state;
      state = ok(recycleWaste(state)).state;
    }
    expect(state.stockCycles).toBe(5);
  });
});
