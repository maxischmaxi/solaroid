// Win Finale: the classic Windows Solitaire winning cascade.
//
// When the player wins, the four foundation piles "explode" — top card first,
// round-robin across foundations — into bouncing card particles. Each particle
// has a small upward + horizontal launch velocity, gravity pulls it down, the
// floor bounces it with restitution, and it eventually slides off the screen.
//
// This module is pure simulation: no canvas, no DOM, no animator. The
// CanvasBoard ticks it each frame and the renderer paints the live particles.

import type { CardId } from "@/lib/game/types";

export interface WinFinaleParticle {
  cardId: CardId;
  x: number;
  y: number;
  /** velocity in px/sec; +x = right, +y = down */
  vx: number;
  vy: number;
}

export interface WinFinaleStartOptions {
  foundations: Array<{
    /** Pile origin in canvas pixels (top-left of the slot). */
    x: number;
    y: number;
    /** Foundation cards bottom-up — last entry is the visible top. */
    cards: readonly CardId[];
  }>;
  boardW: number;
  boardH: number;
  cardW: number;
  cardH: number;
}

interface QueueItem {
  cardId: CardId;
  x: number;
  y: number;
}

/**
 * Tunable physics constants. Picked to feel close to the Windows XP cascade
 * with some restraint so cards don't take forever to leave the screen.
 */
export const WIN_FINALE_PHYSICS = {
  /** Pixels/sec^2. Positive = down. */
  gravity: 1400,
  /** Bounce energy retained on each floor hit. */
  restitution: 0.78,
  /** Below this |vy| the bounce is killed so cards slide off instead of jittering. */
  bounceCutoff: 80,
  /** Wall-clock seconds between launches when foundations are full. */
  launchIntervalMs: 140,
  /** Min/max initial horizontal velocity magnitude. */
  vxMin: 180,
  vxMax: 460,
  /** Initial upward velocity. Negative = up. */
  vyMin: -260,
  vyMax: -120,
  /** Max integration step (clamped to absorb tab-switch lag). */
  maxStepSec: 1 / 30,
};

export class WinFinale {
  private particles: WinFinaleParticle[] = [];
  private launchQueue: QueueItem[] = [];
  private launchedIds = new Set<CardId>();
  private nextLaunchAt = 0;
  private lastTickAt: number | null = null;
  private active = false;
  private bounds = { w: 0, h: 0, cardW: 0, cardH: 0 };
  private rng: () => number;

  /**
   * @param rng Optional deterministic RNG (0..1) for tests. Defaults to Math.random.
   */
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  /** Begin the cascade. Replaces any existing state. */
  start(opts: WinFinaleStartOptions): void {
    this.bounds = {
      w: opts.boardW,
      h: opts.boardH,
      cardW: opts.cardW,
      cardH: opts.cardH,
    };
    this.particles = [];
    this.launchQueue = buildLaunchQueue(opts.foundations);
    this.launchedIds = new Set();
    this.nextLaunchAt = 0;
    this.lastTickAt = null;
    this.active = this.launchQueue.length > 0;
  }

  /** Hard-stop the cascade and forget all state. */
  stop(): void {
    this.particles = [];
    this.launchQueue = [];
    this.launchedIds = new Set();
    this.active = false;
    this.lastTickAt = null;
  }

  /** True while there is something to render or launch. */
  get isActive(): boolean {
    return this.active;
  }

  /** Cards that have already been queued as particles — renderer hides these from foundations. */
  getLaunchedIds(): ReadonlySet<CardId> {
    return this.launchedIds;
  }

  /** Read-only view of the live particles for the renderer. */
  getParticles(): readonly WinFinaleParticle[] {
    return this.particles;
  }

  /**
   * Advance the simulation to wall-clock `now` (ms). Returns the live
   * particles. Mutates internal state.
   */
  tick(now: number): readonly WinFinaleParticle[] {
    if (!this.active) return this.particles;

    if (this.lastTickAt === null) {
      this.lastTickAt = now;
      this.nextLaunchAt = now;
    }
    const dt = Math.min(
      WIN_FINALE_PHYSICS.maxStepSec,
      Math.max(0, (now - this.lastTickAt) / 1000),
    );
    this.lastTickAt = now;

    // Launch as many cards as are due. Clamp to one per frame in normal use,
    // but if we resume after a tab-switch we'll catch up by launching multiple.
    let launchGuard = 0;
    while (
      this.launchQueue.length > 0 &&
      now >= this.nextLaunchAt &&
      launchGuard < 8
    ) {
      const next = this.launchQueue.shift()!;
      this.particles.push(this.spawnParticle(next));
      this.launchedIds.add(next.cardId);
      this.nextLaunchAt += WIN_FINALE_PHYSICS.launchIntervalMs;
      launchGuard++;
    }

    // Integrate physics for every live particle.
    const survivors: WinFinaleParticle[] = [];
    const floorY = this.bounds.h - this.bounds.cardH;
    const cullLeft = -this.bounds.cardW * 1.5;
    const cullRight = this.bounds.w + this.bounds.cardW * 0.5;
    for (const p of this.particles) {
      p.vy += WIN_FINALE_PHYSICS.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= floorY && p.vy > 0) {
        p.y = floorY;
        p.vy = -p.vy * WIN_FINALE_PHYSICS.restitution;
        if (Math.abs(p.vy) < WIN_FINALE_PHYSICS.bounceCutoff) {
          p.vy = 0;
        }
      }
      if (p.x > cullRight || p.x < cullLeft) continue;
      survivors.push(p);
    }
    this.particles = survivors;

    if (this.launchQueue.length === 0 && this.particles.length === 0) {
      this.active = false;
    }
    return this.particles;
  }

  private spawnParticle(item: QueueItem): WinFinaleParticle {
    const phys = WIN_FINALE_PHYSICS;
    // Bias horizontal direction away from the board center so foundations on
    // the right tend to fly right and vice versa — keeps the cascade visually
    // balanced even though each card still gets a randomized magnitude.
    const center = this.bounds.w / 2;
    const dir = item.x + this.bounds.cardW / 2 < center ? -1 : 1;
    const speed = phys.vxMin + this.rng() * (phys.vxMax - phys.vxMin);
    const vx = dir * speed;
    const vy = phys.vyMin + this.rng() * (phys.vyMax - phys.vyMin);
    return { cardId: item.cardId, x: item.x, y: item.y, vx, vy };
  }
}

/**
 * Round-robin queue: layer 0 launches the top of every foundation in order,
 * layer 1 the second-from-top, etc. This depletes the visible piles evenly
 * which matches the Windows cascade.
 *
 * Exported for tests.
 */
export function buildLaunchQueue(
  foundations: WinFinaleStartOptions["foundations"],
): QueueItem[] {
  const out: QueueItem[] = [];
  const maxLen = foundations.reduce((m, f) => Math.max(m, f.cards.length), 0);
  for (let layer = 0; layer < maxLen; layer++) {
    for (const f of foundations) {
      const idx = f.cards.length - 1 - layer;
      if (idx < 0) continue;
      out.push({ cardId: f.cards[idx], x: f.x, y: f.y });
    }
  }
  return out;
}
