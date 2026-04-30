import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { computeCardWidth, computeLayout } from "@/lib/canvas/layout";
import type { PileId } from "@/lib/game/types";

const tableau = (i: number): PileId => `tableau-${i}` as PileId;

describe("computeCardWidth", () => {
  it("clamps card width to the 32..92 range based on board width", () => {
    expect(computeCardWidth(200, 800)).toBe(32); // way below min
    expect(computeCardWidth(600, 800)).toBeCloseTo(600 / 8.44, 3); // mid-range
    expect(computeCardWidth(2000, 1000)).toBe(92); // capped at max
  });

  it("uses the landscape-short branch on phones held sideways", () => {
    // 800 wide, 480 tall — short landscape phone (>= 40 min)
    expect(computeCardWidth(800, 480)).toBeCloseTo(0.11 * 480, 6);
  });

  it("clamps the landscape-short branch to a 40px minimum", () => {
    // 0.11 * 300 = 33, below the 40 minimum
    expect(computeCardWidth(800, 300)).toBe(40);
  });

  it("does not engage landscape-short on tall portrait viewports", () => {
    // 800 wide, 1200 tall: portrait, falls back to width-based formula.
    // byWidth = 800 / 8.44 = 94.78, byHeight = 1200 / 5.5 = 218 → 94.78 → 92.
    expect(computeCardWidth(800, 1200)).toBe(92);
  });

  it("falls back to the height axis when the viewport is short and narrow", () => {
    // 360 wide, 500 tall — portrait phone with collapsed URL bar.
    // byWidth = 360 / 8.44 = 42.65, byHeight = 500 / 5.5 = 90.9 → min = 42.65
    // (still width-bound).
    expect(computeCardWidth(360, 500)).toBeCloseTo(360 / 8.44, 3);
  });

  it("uses the height axis when it constrains more than the width", () => {
    // 1000 wide, 300 tall — wide-but-short window. Landscape-short branch is
    // skipped (we'd need boardW > boardH AND boardH ≤ 560: both true here).
    // So this hits landscape-short: clamp(40, 0.11 × 300, 80) = 40.
    expect(computeCardWidth(1000, 300)).toBe(40);

    // Portrait but very short on height (e.g. embedded iframe). 700 wide,
    // 220 tall: boardW > boardH, boardH ≤ 560 → landscape-short.
    expect(computeCardWidth(700, 220)).toBe(40);
  });
});

describe("computeLayout", () => {
  const game = dealKlondike("layout-test-seed", 1);

  it("produces 13 piles with the correct types", () => {
    const layout = computeLayout(game, 776, 600, 1);
    expect(layout.piles["stock"].kind).toBe("stock");
    expect(layout.piles["waste"].kind).toBe("waste");
    expect(layout.piles["foundation-0"].kind).toBe("foundation");
    expect(layout.piles["foundation-3"].kind).toBe("foundation");
    expect(layout.piles["tableau-0"].kind).toBe("tableau");
    expect(layout.piles["tableau-6"].kind).toBe("tableau");
  });

  it("derives card height from card width via the 1.4 aspect ratio", () => {
    const layout = computeLayout(game, 776, 600, 1);
    expect(layout.cardH).toBeCloseTo(layout.cardW * 1.4, 6);
  });

  it("places stock and tableau-0 at the same x", () => {
    const layout = computeLayout(game, 776, 600, 1);
    expect(layout.piles["stock"].x).toBe(layout.piles["tableau-0"].x);
  });

  it("evenly spaces tableau columns by (cardW + pileGap)", () => {
    const layout = computeLayout(game, 776, 600, 1);
    const stride = layout.cardW + layout.pileGap;
    for (let i = 1; i < 7; i++) {
      const prev = layout.piles[tableau(i - 1)].x;
      const cur = layout.piles[tableau(i)].x;
      expect(cur - prev).toBeCloseTo(stride, 6);
    }
  });

  it("places foundations to the right of waste with a 1-column spacer", () => {
    const layout = computeLayout(game, 776, 600, 1);
    // Foundations 0..3 are at columns 3..6, same as tableau columns 3..6
    expect(layout.piles["foundation-0"].x).toBe(layout.piles["tableau-3"].x);
    expect(layout.piles["foundation-3"].x).toBe(layout.piles["tableau-6"].x);
  });

  it("fans tableau cards down by exactly fanDown per stack index", () => {
    const layout = computeLayout(game, 776, 600, 1);
    // After dealKlondike, tableau-6 has 7 cards
    const t6 = layout.piles["tableau-6"];
    expect(t6.cards).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(t6.cards[i].y - t6.cards[0].y).toBeCloseTo(i * layout.fanDown, 6);
    }
  });

  it("indexes every dealt card by id", () => {
    const layout = computeLayout(game, 776, 600, 1);
    // All 52 cards live somewhere
    expect(Object.keys(layout.cardIndex)).toHaveLength(52);
    // Spot-check: the top of tableau-6 should map back to its pile
    const top = game.tableau[6].cards[6];
    expect(layout.cardIndex[top.id]).toEqual({
      pileId: "tableau-6",
      indexInPile: 6,
    });
  });

  it("extends drop rect for tableau columns to cover the full fan", () => {
    const layout = computeLayout(game, 776, 600, 1);
    const t6 = layout.piles["tableau-6"];
    // 7 cards: dropRect height = cardH + 6*fanDown
    expect(t6.dropRect.h).toBeCloseTo(
      layout.cardH + 6 * layout.fanDown,
      6,
    );
  });

  it("fans the visible waste cards horizontally in draw-3 mode", () => {
    // Construct a waste pile of 5 cards manually
    const seedGame = dealKlondike("waste-test", 3);
    const wasteCards = seedGame.stock.cards.slice(0, 5).map((c) => ({
      ...c,
      faceUp: true,
    }));
    const stateWithWaste = {
      ...seedGame,
      waste: { ...seedGame.waste, cards: wasteCards },
    };
    const layout = computeLayout(stateWithWaste, 776, 600, 3);
    const wasteBox = layout.piles["waste"];
    // The last 3 cards should be fanned with x-offset of cardW * 0.18
    const lastIdx = wasteCards.length - 1;
    const c0 = wasteBox.cards[lastIdx - 2];
    const c2 = wasteBox.cards[lastIdx];
    expect(c2.x - c0.x).toBeCloseTo(layout.cardW * 0.18 * 2, 6);
  });

  it("fits a 7-column tableau inside a 360px-wide phone viewport", () => {
    // 360px wide × 720 high — typical phone after the header is subtracted.
    const layout = computeLayout(game, 360, 720, 1);
    // Last tableau column's right edge must stay inside the viewport, with a
    // single pile-gap of breathing room on the right (the formula reserves
    // 0.18 × cardW on each side).
    const t6 = layout.piles["tableau-6"];
    expect(t6.x + t6.w).toBeLessThanOrEqual(360);
    // And the foundations row aligns with tableau columns 3..6.
    expect(layout.piles["foundation-3"].x).toBeCloseTo(t6.x, 6);
  });

  it("keeps the bottom of a 12-card tableau inside a short phone viewport", () => {
    // Manually stack tableau-0 with 12 cards from the stock — realistic
    // mid-game depth on the longest column. We don't care about legality
    // here, only about the rendered y-coordinates.
    const cards = game.stock.cards.slice(0, 12).map((c, i) => ({
      ...c,
      faceUp: i === 11,
    }));
    const stacked = {
      ...game,
      tableau: [
        { ...game.tableau[0], cards },
        ...game.tableau.slice(1),
      ] as unknown as typeof game.tableau,
    };
    const layout = computeLayout(stacked, 360, 600, 1);
    const t0 = layout.piles["tableau-0"];
    expect(t0.cards).toHaveLength(12);
    // The 9-row safety margin (HEIGHT_DIVISOR = 5.5) means a 12-card stack
    // can extend a bit past the bottom on a 600px viewport — but not by more
    // than ~3 fanDown rows. Bound it loosely so the test catches catastrophic
    // overflow without being brittle to the exact ratio.
    const bottom = t0.cards[11].y + t0.cards[11].h;
    expect(bottom).toBeLessThan(600 + 3 * layout.fanDown);
  });

  it("treats empty tableau columns with a single-card-slot drop rect", () => {
    // Manually empty tableau-0
    const empty = {
      ...game,
      tableau: [
        { ...game.tableau[0], cards: [] },
        ...game.tableau.slice(1),
      ] as unknown as typeof game.tableau,
    };
    const layout = computeLayout(empty, 776, 600, 1);
    const t0 = layout.piles["tableau-0"];
    expect(t0.cards).toHaveLength(0);
    expect(t0.dropRect.h).toBe(layout.cardH);
  });
});
