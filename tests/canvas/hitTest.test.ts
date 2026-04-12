import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { computeLayout } from "@/lib/canvas/layout";
import { dropTest, hitTest } from "@/lib/canvas/hitTest";
import type { PileId } from "@/lib/game/types";

const tab = (i: number): PileId => `tableau-${i}` as PileId;
const fnd = (i: number): PileId => `foundation-${i}` as PileId;

describe("hitTest", () => {
  const game = dealKlondike("hit-test-seed", 1);
  const layout = computeLayout(game, 776, 600, 1);
  const center = (r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
  });

  it("returns the stock pile for clicks on the stock slot", () => {
    const c = center(layout.piles["stock"]);
    expect(hitTest(layout, c.x, c.y)).toEqual({
      kind: "pile",
      pileId: "stock",
    });
  });

  it("returns 'none' for clicks on empty foundations (drop target only)", () => {
    const c = center(layout.piles[fnd(0)]);
    expect(hitTest(layout, c.x, c.y)).toEqual({ kind: "none" });
  });

  it("returns the topmost face-up card on a tableau column", () => {
    // tableau-3 has 4 cards, top one is face-up
    const t3 = layout.piles[tab(3)];
    const top = t3.cards[3];
    const result = hitTest(layout, top.x + top.w / 2, top.y + top.h / 2);
    expect(result.kind).toBe("card");
    if (result.kind === "card") {
      expect(result.cardId).toBe(top.cardId);
      expect(result.indexInPile).toBe(3);
    }
  });

  it("does not pick face-down tableau cards (top is the only face-up)", () => {
    const t3 = layout.piles[tab(3)];
    const faceDown = t3.cards[0];
    // Hit the visible strip of the bottom card (above the next card)
    const result = hitTest(layout, faceDown.x + 5, faceDown.y + 5);
    // Bottom card is face-down → no hit on it. The result should fall to the
    // next face-up card if any in this strip; in dealKlondike only the top is
    // face-up, so the bottom strip yields 'none'.
    expect(result.kind).toBe("none");
  });

  it("returns 'none' for clicks in the felt background", () => {
    expect(hitTest(layout, 5, layout.boardH - 5)).toEqual({ kind: "none" });
  });
});

describe("dropTest", () => {
  const game = dealKlondike("drop-test-seed", 1);
  const layout = computeLayout(game, 776, 600, 1);

  it("identifies tableau columns by their dropRect", () => {
    const t2 = layout.piles[tab(2)];
    const probeY = t2.dropRect.y + t2.dropRect.h - 5; // bottom of fanned column
    expect(dropTest(layout, t2.x + t2.w / 2, probeY)).toBe(tab(2));
  });

  it("identifies foundation slots", () => {
    const f1 = layout.piles[fnd(1)];
    expect(dropTest(layout, f1.x + f1.w / 2, f1.y + f1.h / 2)).toBe(fnd(1));
  });

  it("returns null for the stock pile (not a drop target)", () => {
    const s = layout.piles["stock"];
    expect(dropTest(layout, s.x + s.w / 2, s.y + s.h / 2)).toBeNull();
  });

  it("returns null for the waste pile (not a drop target)", () => {
    const w = layout.piles["waste"];
    expect(dropTest(layout, w.x + w.w / 2, w.y + w.h / 2)).toBeNull();
  });

  it("returns null for clicks in the felt background", () => {
    expect(dropTest(layout, 5, layout.boardH - 5)).toBeNull();
  });
});
