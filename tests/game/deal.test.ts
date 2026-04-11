import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";

describe("dealKlondike", () => {
  it("creates 7 tableau piles with 1..7 cards", () => {
    const state = dealKlondike("seed-1");
    for (let i = 0; i < 7; i++) {
      expect(state.tableau[i].cards).toHaveLength(i + 1);
    }
  });

  it("flips only the topmost tableau card face-up", () => {
    const state = dealKlondike("seed-1");
    for (const pile of state.tableau) {
      const top = pile.cards[pile.cards.length - 1];
      expect(top.faceUp).toBe(true);
      for (let i = 0; i < pile.cards.length - 1; i++) {
        expect(pile.cards[i].faceUp).toBe(false);
      }
    }
  });

  it("places the remaining 24 cards face-down in the stock", () => {
    const state = dealKlondike("seed-1");
    expect(state.stock.cards).toHaveLength(24);
    expect(state.stock.cards.every((c) => c.faceUp === false)).toBe(true);
  });

  it("starts with empty waste and empty foundations", () => {
    const state = dealKlondike("seed-1");
    expect(state.waste.cards).toHaveLength(0);
    expect(state.foundations.every((f) => f.cards.length === 0)).toBe(true);
  });

  it("starts with score 0, moveCount 0, idle status, drawMode 1", () => {
    const state = dealKlondike("seed-1");
    expect(state.score).toBe(0);
    expect(state.moveCount).toBe(0);
    expect(state.status).toBe("idle");
    expect(state.drawMode).toBe(1);
    expect(state.startedAt).toBeNull();
    expect(state.stockCycles).toBe(0);
  });

  it("respects the drawMode argument", () => {
    expect(dealKlondike("seed-1", 3).drawMode).toBe(3);
  });

  it("is deterministic for the same seed", () => {
    const a = dealKlondike("identical");
    const b = dealKlondike("identical");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("differs for different seeds", () => {
    const a = dealKlondike("seed-A");
    const b = dealKlondike("seed-B");
    expect(JSON.stringify(a.tableau)).not.toBe(JSON.stringify(b.tableau));
  });

  it("totals exactly 52 cards across all piles", () => {
    const state = dealKlondike("seed-1");
    const total =
      state.tableau.reduce((sum, p) => sum + p.cards.length, 0) +
      state.foundations.reduce((sum, p) => sum + p.cards.length, 0) +
      state.stock.cards.length +
      state.waste.cards.length;
    expect(total).toBe(52);
  });
});
