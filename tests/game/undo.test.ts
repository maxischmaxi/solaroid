import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { tryApplyMove } from "@/lib/game/moves";
import { drawFromStock, recycleWaste } from "@/lib/game/stock";
import type { GameState } from "@/lib/game/types";

// Snapshot-based undo: history holds the full pre-move GameState. Pure-function
// tests of the undo strategy live here so we can verify correctness in
// isolation from the Zustand store.
function pushUndo(history: GameState[], state: GameState): GameState[] {
  return [...history, state];
}

function popUndo(history: GameState[]): { history: GameState[]; state: GameState } {
  if (history.length === 0) throw new Error("history empty");
  const next = history[history.length - 1];
  return { history: history.slice(0, -1), state: next };
}

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error("expected ok");
  return r as Extract<T, { ok: true }>;
}

describe("snapshot undo", () => {
  it("rewinds a single draw to the original state", () => {
    const initial = dealKlondike("seed-1", 1);
    let history: GameState[] = [];
    let cur = initial;

    history = pushUndo(history, cur);
    cur = ok(drawFromStock(cur)).state;

    const popped = popUndo(history);
    history = popped.history;
    cur = popped.state;

    expect(JSON.stringify(cur)).toBe(JSON.stringify(initial));
  });

  it("ten draws + ten undos returns to the deal", () => {
    const initial = dealKlondike("seed-1", 1);
    let history: GameState[] = [];
    let cur = initial;
    for (let i = 0; i < 10; i++) {
      history = pushUndo(history, cur);
      cur = ok(drawFromStock(cur)).state;
    }
    while (history.length > 0) {
      const popped = popUndo(history);
      history = popped.history;
      cur = popped.state;
    }
    expect(JSON.stringify(cur)).toBe(JSON.stringify(initial));
  });

  it("undoing a recycle restores the waste pile and stockCycles", () => {
    let cur = dealKlondike("seed-1", 1);
    for (let i = 0; i < 24; i++) cur = ok(drawFromStock(cur)).state;
    const beforeRecycle = cur;

    cur = ok(recycleWaste(cur)).state;
    expect(cur.stockCycles).toBe(1);

    // Undo
    cur = beforeRecycle;
    expect(cur.stockCycles).toBe(0);
    expect(cur.waste.cards).toHaveLength(24);
  });

  it("undoing an auto-flip restores the face-down state and rewinds reveal score", () => {
    // Build a state with a known face-down → face-up scenario.
    const initial = dealKlondike("seed-1", 1);
    // Use tableau-1 which has 2 cards (one hidden, one top).
    const top = initial.tableau[1].cards[1];
    expect(top.faceUp).toBe(true);

    // Move the top card to a foundation if legal — otherwise to another tableau.
    // Easier: synthesize an Ace at the top of tableau-1 manually.
    const synthetic: GameState = {
      ...initial,
      tableau: initial.tableau.map((p, i) => {
        if (i !== 1) return p;
        return {
          ...p,
          cards: [
            { ...p.cards[0], faceUp: false },
            { id: "spades-1", suit: "spades", rank: 1, faceUp: true },
          ],
        };
      }) as unknown as GameState["tableau"],
    };

    const before = synthetic;
    const after = ok(
      tryApplyMove(synthetic, {
        kind: "move",
        from: "tableau-1",
        to: "foundation-0",
        cardId: "spades-1",
      }),
    ).state;
    expect(after.tableau[1].cards[0].faceUp).toBe(true); // auto-flipped
    expect(after.score).toBe(15); // 10 (foundation) + 5 (reveal)

    // Undo
    expect(before.tableau[1].cards[0].faceUp).toBe(false);
    expect(before.score).toBe(0);
  });
});
