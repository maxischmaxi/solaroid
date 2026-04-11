import { describe, expect, it } from "vitest";
import {
  finalScore,
  flipReveal,
  moveScoreDelta,
  recyclePenalty,
  timeBonus,
} from "@/lib/game/scoring";

describe("moveScoreDelta", () => {
  it("waste → tableau = +5", () => {
    expect(moveScoreDelta("waste", "tableau")).toBe(5);
  });
  it("waste → foundation = +10", () => {
    expect(moveScoreDelta("waste", "foundation")).toBe(10);
  });
  it("tableau → foundation = +10", () => {
    expect(moveScoreDelta("tableau", "foundation")).toBe(10);
  });
  it("foundation → tableau = -15", () => {
    expect(moveScoreDelta("foundation", "tableau")).toBe(-15);
  });
  it("tableau → tableau = 0", () => {
    expect(moveScoreDelta("tableau", "tableau")).toBe(0);
  });
});

describe("recyclePenalty", () => {
  it("Draw 1 = -100", () => {
    expect(recyclePenalty(1)).toBe(-100);
  });
  it("Draw 3 = -20", () => {
    expect(recyclePenalty(3)).toBe(-20);
  });
});

describe("flipReveal", () => {
  it("flipping a tableau card = +5", () => {
    expect(flipReveal()).toBe(5);
  });
});

describe("timeBonus", () => {
  it("bonus is positive for fast wins", () => {
    expect(timeBonus(60_000)).toBeGreaterThan(0);
  });
  it("bonus clamps to 0 for very slow wins", () => {
    // 700_000 / sec - 7*sec = 0 around sec ≈ 316; way past that should clamp.
    expect(timeBonus(60 * 60 * 1000)).toBe(0);
  });
  it("0 elapsed treated as 1 second to avoid division by zero", () => {
    expect(timeBonus(0)).toBe(700_000 - 7);
  });
});

describe("finalScore", () => {
  it("adds the time bonus to the running score", () => {
    expect(finalScore(100, 60_000)).toBe(100 + timeBonus(60_000));
  });
});
