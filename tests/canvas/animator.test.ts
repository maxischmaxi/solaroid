import { describe, expect, it, vi } from "vitest";
import {
  Animator,
  easeInOutQuad,
  easeOutCubic,
  linear,
} from "@/lib/canvas/animator";
import type { Tween } from "@/lib/canvas/types";

const tween = (over: Partial<Tween> = {}): Tween => ({
  id: "spades-7",
  cardId: "spades-7",
  kind: "move",
  from: { x: 0, y: 0, face: "up" },
  to: { x: 100, y: 0, face: "up" },
  duration: 200,
  easing: linear,
  ...over,
});

describe("Animator", () => {
  it("interpolates linearly along the t axis", () => {
    const a = new Animator();
    a.add(tween(), 0);
    expect(a.tick(0).active[0].x).toBe(0);
    expect(a.tick(100).active[0].x).toBe(50);
    expect(a.tick(199).active[0].x).toBeCloseTo(99.5, 1);
  });

  it("clamps to the end and removes the tween at completion", () => {
    const a = new Animator();
    a.add(tween(), 0);
    expect(a.size).toBe(1);
    const snap = a.tick(200);
    expect(snap.active[0].x).toBe(100);
    expect(a.size).toBe(0); // reaped
  });

  it("fires onComplete exactly once", () => {
    const cb = vi.fn();
    const a = new Animator();
    a.add(tween({ onComplete: cb }), 0);
    a.tick(100); // mid
    expect(cb).not.toHaveBeenCalled();
    a.tick(200); // end
    expect(cb).toHaveBeenCalledTimes(1);
    a.tick(300); // post-completion
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("respects delay before starting", () => {
    const a = new Animator();
    a.add(tween({ delay: 100 }), 0);
    // During delay, snapshot returns the from position.
    expect(a.tick(50).active[0].x).toBe(0);
    // After delay, animation begins from t=0.
    expect(a.tick(100).active[0].x).toBe(0);
    expect(a.tick(200).active[0].x).toBe(50); // halfway through 200ms
  });

  it("dedupes by id and captures current position as new from", () => {
    const a = new Animator();
    a.add(tween(), 0);
    // Halfway through, replace the tween with one targeting x=200
    const snap1 = a.tick(100); // x=50
    expect(snap1.active[0].x).toBe(50);
    a.add(
      tween({
        to: { x: 200, y: 0, face: "up" },
      }),
      100,
    );
    expect(a.size).toBe(1); // still just one tween for this id
    // After 100ms more, the new tween is halfway from 50 → 200 = 125
    const snap2 = a.tick(200);
    expect(snap2.active[0].x).toBe(125);
  });

  it("supports flip via face change with scaleX two-phase", () => {
    const a = new Animator();
    a.add(
      tween({
        from: { x: 0, y: 0, face: "down" },
        to: { x: 0, y: 0, face: "up" },
      }),
      0,
    );
    // First half: shows 'down', scaleX shrinks 1 → 0
    const s1 = a.tick(50); // t=0.25
    expect(s1.active[0].face).toBe("down");
    expect(s1.active[0].scaleX).toBeCloseTo(0.5, 6);
    // Second half: shows 'up', scaleX grows 0 → 1
    const s2 = a.tick(150); // t=0.75
    expect(s2.active[0].face).toBe("up");
    expect(s2.active[0].scaleX).toBeCloseTo(0.5, 6);
  });

  it("respects reduced motion by collapsing duration to 0", () => {
    const cb = vi.fn();
    const a = new Animator();
    a.setReducedMotion(true);
    a.add(tween({ duration: 200, onComplete: cb }), 0);
    const snap = a.tick(0);
    expect(snap.active[0].x).toBe(100); // immediate end
    expect(a.size).toBe(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancel() removes a tween without firing onComplete", () => {
    const cb = vi.fn();
    const a = new Animator();
    a.add(tween({ onComplete: cb }), 0);
    a.cancel("spades-7");
    expect(a.size).toBe(0);
    a.tick(200);
    expect(cb).not.toHaveBeenCalled();
  });

  it("skipToEnd flushes everything and fires callbacks", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const a = new Animator();
    a.add(tween({ id: "a", cardId: "spades-1", onComplete: cb1 }), 0);
    a.add(tween({ id: "b", cardId: "hearts-2", onComplete: cb2 }), 0);
    a.skipToEnd();
    expect(a.size).toBe(0);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("populates suppressIds for every active card so the renderer skips them", () => {
    const a = new Animator();
    a.add(tween({ id: "a", cardId: "spades-1" }), 0);
    a.add(tween({ id: "b", cardId: "hearts-2" }), 0);
    const snap = a.tick(100);
    expect(snap.suppressIds.has("spades-1")).toBe(true);
    expect(snap.suppressIds.has("hearts-2")).toBe(true);
  });
});

describe("easings", () => {
  it("linear is identity", () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(1)).toBe(1);
  });

  it("easeOutCubic ends at 1 and starts faster than linear", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("easeInOutQuad ends at 1 and is symmetric around 0.5", () => {
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(1)).toBe(1);
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 6);
  });
});
