// Animator: a tween queue with rAF-driven progress, easings, id-based dedupe,
// and reduced-motion fast path. The animator is canvas-agnostic — it just
// computes interpolated positions and the renderer paints them.

import type {
  AnimSnapshot,
  Easing,
  Tween,
  TweenEndpoint,
} from "./types";
import type { CardId } from "@/lib/game/types";

/* ---------- Easings ---------- */

export const linear: Easing = (t) => t;
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* ---------- Animator ---------- */

interface ActiveTween extends Tween {
  /** Wall-clock time at which this tween was added (used for delay timing). */
  addedAt: number;
}

export class Animator {
  private tweens = new Map<string, ActiveTween>();
  private reducedMotion = false;

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  /**
   * Add (or replace) a tween. If a tween with the same id is already running,
   * its current interpolated position is captured as the new tween's `from`
   * so the transition is continuous.
   */
  add(tween: Tween, now: number = performance.now()): void {
    const existing = this.tweens.get(tween.id);
    let from = tween.from;
    if (existing) {
      // Capture current interpolated position so the new tween starts there.
      const sample = sampleTween(existing, now);
      from = { x: sample.x, y: sample.y, face: sample.face };
      // Fire any pending complete callback for cancelled tween? No — the
      // outgoing animation didn't actually finish; just drop its callback.
    }
    const next: ActiveTween = {
      ...tween,
      from,
      duration: this.reducedMotion ? 0 : tween.duration,
      addedAt: now,
    };
    this.tweens.set(next.id, next);
  }

  /** Cancel a tween by id without firing its onComplete. */
  cancel(id: string): void {
    this.tweens.delete(id);
  }

  /** Remove all tweens. Does not fire onComplete callbacks. */
  clear(): void {
    this.tweens.clear();
  }

  /** True if no tweens are active. */
  get isIdle(): boolean {
    return this.tweens.size === 0;
  }

  /**
   * Advance to `now` and return a snapshot for rendering. Tweens that have
   * finished are removed from the active set and their onComplete callbacks
   * are invoked exactly once.
   */
  tick(now: number = performance.now()): AnimSnapshot {
    const active: AnimSnapshot["active"] = [];
    const suppressIds = new Set<CardId>();
    const completed: ActiveTween[] = [];

    for (const t of this.tweens.values()) {
      const elapsed = now - t.addedAt - (t.delay ?? 0);
      if (elapsed < 0) {
        // Pre-roll: render at the from position so the card visibly waits.
        active.push({
          tween: t,
          eased: 0,
          x: t.from.x,
          y: t.from.y,
          face: t.from.face,
          scaleX: 1,
        });
        suppressIds.add(t.cardId);
        continue;
      }
      const linearT = t.duration <= 0 ? 1 : Math.min(1, elapsed / t.duration);
      const easedT = t.easing(linearT);
      const sample = interp(t.from, t.to, easedT);
      active.push({
        tween: t,
        eased: easedT,
        x: sample.x,
        y: sample.y,
        face: sample.face,
        scaleX: sample.scaleX,
      });
      suppressIds.add(t.cardId);
      if (linearT >= 1) completed.push(t);
    }

    // Reap completed tweens after iteration.
    for (const t of completed) {
      this.tweens.delete(t.id);
      try {
        t.onComplete?.();
      } catch {
        // Swallow callback errors so the rAF loop never crashes.
      }
    }

    return { active, suppressIds };
  }

  /**
   * Skip every active tween to its end state, firing onComplete callbacks.
   * Used when the tab returns from background or when the user wants to
   * dismiss in-flight animations.
   */
  skipToEnd(): void {
    const completed = Array.from(this.tweens.values());
    this.tweens.clear();
    for (const t of completed) {
      try {
        t.onComplete?.();
      } catch {
        // ignore
      }
    }
  }

  /**
   * For tests: how many tweens are currently active.
   */
  get size(): number {
    return this.tweens.size;
  }
}

/* ---------- Interpolation helpers ---------- */

interface Sample {
  x: number;
  y: number;
  face: "up" | "down";
  scaleX: number;
}

function interp(from: TweenEndpoint, to: TweenEndpoint, t: number): Sample {
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  let face: "up" | "down";
  let scaleX = 1;
  if (from.face === to.face) {
    face = from.face;
  } else {
    // Two-phase flip: scaleX 1→0 first half (showing `from`), 0→1 second
    // half (showing `to`).
    if (t < 0.5) {
      face = from.face;
      scaleX = 1 - t * 2;
    } else {
      face = to.face;
      scaleX = (t - 0.5) * 2;
    }
  }
  return { x, y, face, scaleX };
}

function sampleTween(tween: ActiveTween, now: number): Sample {
  const elapsed = now - tween.addedAt - (tween.delay ?? 0);
  if (elapsed < 0) {
    return { x: tween.from.x, y: tween.from.y, face: tween.from.face, scaleX: 1 };
  }
  const linearT =
    tween.duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.duration));
  const easedT = tween.easing(linearT);
  return interp(tween.from, tween.to, easedT);
}
