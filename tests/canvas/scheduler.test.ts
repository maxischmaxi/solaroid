import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { tryApplyMove } from "@/lib/game/moves";
import { computeLayout } from "@/lib/canvas/layout";
import { Animator } from "@/lib/canvas/animator";
import {
  createScheduler,
  diffLayouts,
} from "@/lib/canvas/scheduler";
import type { GameState, PileId } from "@/lib/game/types";

const fnd = (i: number): PileId => `foundation-${i}` as PileId;

function makeDeps(animator: Animator) {
  return {
    animator,
    getBoardSize: () => ({ w: 776, h: 600 }),
  };
}

describe("diffLayouts", () => {
  it("returns no tweens for identical layouts", () => {
    const game = dealKlondike("scheduler-1");
    const layout = computeLayout(game, 776, 600, 1);
    expect(diffLayouts(layout, layout)).toHaveLength(0);
  });

  it("emits one tween per moved card after a draw", () => {
    const game = dealKlondike("scheduler-2", 1);
    const prev = computeLayout(game, 776, 600, 1);
    const drew = tryApplyMove(game, { kind: "draw" });
    if (!drew.ok) throw new Error("draw failed");
    const next = computeLayout(drew.state, 776, 600, 1);
    const tweens = diffLayouts(prev, next);
    // Draw mode 1 → exactly one card moved (stock top → waste top)
    expect(tweens).toHaveLength(1);
    expect(tweens[0].from.face).toBe("down");
    expect(tweens[0].to.face).toBe("up");
  });

  it("emits multiple tweens for a draw-3", () => {
    const game = dealKlondike("scheduler-3", 3);
    const prev = computeLayout(game, 776, 600, 3);
    const drew = tryApplyMove(game, { kind: "draw" });
    if (!drew.ok) throw new Error("draw failed");
    const next = computeLayout(drew.state, 776, 600, 3);
    const tweens = diffLayouts(prev, next);
    expect(tweens.length).toBe(3);
  });
});

describe("Scheduler", () => {
  it("first reconcile after reset() does not emit any tweens", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("first-reconcile");
    sched.reset();
    sched.reconcile(game);
    expect(animator.size).toBe(0);
  });

  it("emits move tweens for a normal dispatchMove", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("move-test", 1);

    // Seed the prev layout via the first (no-op) reconcile.
    sched.reconcile(game);
    expect(animator.size).toBe(0);

    // Apply a draw, then reconcile — should emit at least one tween.
    const drew = tryApplyMove(game, { kind: "draw" });
    if (!drew.ok) throw new Error("draw failed");
    sched.reconcile(drew.state);
    expect(animator.size).toBeGreaterThan(0);
  });

  it("applies the draw stagger when hint='draw'", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("draw-hint", 3);

    sched.reconcile(game);
    const drew = tryApplyMove(game, { kind: "draw" });
    if (!drew.ok) throw new Error("draw failed");
    sched.reconcile(drew.state, "draw");

    expect(animator.size).toBe(3);
    // Inspect the active tweens via tick()
    const snap = animator.tick(0);
    const delays = snap.active.map((a) => a.tween.delay ?? 0).sort((a, b) => a - b);
    expect(delays).toEqual([0, 40, 80]);
  });

  it("applies the recycle stagger when hint='recycle'", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    // Build a state where we can recycle: move all stock into waste, then recycle.
    let g: GameState = dealKlondike("recycle-hint", 1);
    // Drain the stock into waste with sequential draws.
    while (g.stock.cards.length > 0) {
      const r = tryApplyMove(g, { kind: "draw" });
      if (!r.ok) throw new Error("draw failed");
      g = r.state;
    }
    sched.reconcile(g);

    const recycled = tryApplyMove(g, { kind: "recycle" });
    if (!recycled.ok) throw new Error("recycle failed");
    sched.reconcile(recycled.state, "recycle");

    expect(animator.size).toBe(g.waste.cards.length);
    const snap = animator.tick(0);
    expect(
      snap.active.every((a) => a.tween.kind === "recycle"),
    ).toBe(true);
    // Recycle tweens must NEVER expose card faces — both endpoints are
    // 'down' so the animator never flips and the future stock-top card
    // stays hidden during the entire cascade.
    expect(
      snap.active.every(
        (a) => a.tween.from.face === "down" && a.tween.to.face === "down",
      ),
    ).toBe(true);
  });

  it("emits 28 deal tweens with stagger when hint='deal'", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("deal-hint");
    // First reconcile establishes prev (no animation).
    sched.reconcile(game);
    // Now request a "redeal" — pretend the same game is being dealt fresh.
    sched.reconcile(game, "deal");
    // 1+2+3+4+5+6+7 = 28 tableau cards
    expect(animator.size).toBe(28);
    const snap = animator.tick(0);
    expect(snap.active.every((a) => a.tween.kind === "deal")).toBe(true);
    // Stagger increases monotonically
    const delays = snap.active.map((a) => a.tween.delay ?? 0);
    expect(Math.max(...delays)).toBe(27 * 25);
  });

  it("does not emit tweens for cards that already match", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("match-test");
    sched.reconcile(game);
    sched.reconcile(game); // identical state
    expect(animator.size).toBe(0);
  });
});

describe("end-to-end: draw → undo round-trip", () => {
  it("emits inverse tweens after undo", () => {
    const animator = new Animator();
    const sched = createScheduler(makeDeps(animator));
    const game = dealKlondike("undo-rt", 1);
    sched.reconcile(game);

    const drew = tryApplyMove(game, { kind: "draw" });
    if (!drew.ok) throw new Error("draw failed");
    sched.reconcile(drew.state);
    expect(animator.size).toBeGreaterThan(0);

    // Capture and clear, then "undo" by reconciling back to original.
    animator.clear();
    sched.reconcile(game);
    expect(animator.size).toBeGreaterThan(0);
    // The card flies face-up (waste) → face-down (stock)
    const snap = animator.tick(0);
    const flipBack = snap.active.find(
      (a) => a.tween.from.face === "up" && a.tween.to.face === "down",
    );
    expect(flipBack).toBeDefined();
  });
});

// Avoid unused-import warnings on the helper imports we don't use directly.
void fnd;
