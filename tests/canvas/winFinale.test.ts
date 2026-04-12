import { describe, expect, it } from "vitest";
import {
  WIN_FINALE_PHYSICS,
  WinFinale,
  buildLaunchQueue,
} from "@/lib/canvas/winFinale";
import type { CardId } from "@/lib/game/types";

const FOUNDATIONS = (): Array<{ x: number; y: number; cards: CardId[] }> => [
  {
    x: 100,
    y: 10,
    cards: [
      "clubs-1" as CardId,
      "clubs-2" as CardId,
      "clubs-3" as CardId,
      "clubs-4" as CardId,
      "clubs-5" as CardId,
      "clubs-6" as CardId,
      "clubs-7" as CardId,
      "clubs-8" as CardId,
      "clubs-9" as CardId,
      "clubs-10" as CardId,
      "clubs-11" as CardId,
      "clubs-12" as CardId,
      "clubs-13" as CardId,
    ],
  },
  {
    x: 200,
    y: 10,
    cards: ["diamonds-1" as CardId, "diamonds-2" as CardId, "diamonds-3" as CardId],
  },
  {
    x: 300,
    y: 10,
    cards: ["hearts-1" as CardId, "hearts-2" as CardId],
  },
  {
    x: 400,
    y: 10,
    cards: ["spades-1" as CardId],
  },
];

const fixedRng = (): (() => number) => {
  // Cycle through a small deterministic sequence so spawn velocities are
  // reproducible across runs.
  let i = 0;
  const seq = [0.2, 0.7, 0.4, 0.9, 0.1, 0.5];
  return () => {
    const v = seq[i % seq.length];
    i++;
    return v;
  };
};

describe("buildLaunchQueue", () => {
  it("emits foundation tops in round-robin order, layer by layer", () => {
    const q = buildLaunchQueue(FOUNDATIONS());
    // Total cards: 13 + 3 + 2 + 1 = 19
    expect(q).toHaveLength(19);
    // Layer 0: each foundation's TOP card (last entry).
    expect(q[0].cardId).toBe("clubs-13");
    expect(q[1].cardId).toBe("diamonds-3");
    expect(q[2].cardId).toBe("hearts-2");
    expect(q[3].cardId).toBe("spades-1");
    // Layer 1: only foundations 0..2 still have something.
    expect(q[4].cardId).toBe("clubs-12");
    expect(q[5].cardId).toBe("diamonds-2");
    expect(q[6].cardId).toBe("hearts-1");
    // Layer 2: foundations 0..1 only.
    expect(q[7].cardId).toBe("clubs-11");
    expect(q[8].cardId).toBe("diamonds-1");
    // Layers 3..12: only foundation-0.
    for (let i = 9; i < 19; i++) {
      expect(q[i].cardId.startsWith("clubs-")).toBe(true);
    }
  });

  it("returns an empty queue when no foundations have cards", () => {
    expect(buildLaunchQueue([])).toEqual([]);
    expect(
      buildLaunchQueue([
        { x: 0, y: 0, cards: [] },
        { x: 0, y: 0, cards: [] },
      ]),
    ).toEqual([]);
  });
});

describe("WinFinale", () => {
  it("becomes active on start when foundations have cards", () => {
    const f = new WinFinale(fixedRng());
    expect(f.isActive).toBe(false);
    f.start({
      foundations: FOUNDATIONS(),
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    expect(f.isActive).toBe(true);
  });

  it("does nothing when foundations are empty", () => {
    const f = new WinFinale(fixedRng());
    f.start({
      foundations: [],
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    expect(f.isActive).toBe(false);
  });

  it("launches the first card on the first tick and adds it to launchedIds", () => {
    const f = new WinFinale(fixedRng());
    f.start({
      foundations: FOUNDATIONS(),
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    f.tick(1000);
    expect(f.getParticles().length).toBeGreaterThanOrEqual(1);
    expect(f.getLaunchedIds().has("clubs-13" as CardId)).toBe(true);
  });

  it("eventually launches every queued card and then deactivates", () => {
    const f = new WinFinale(fixedRng());
    f.start({
      foundations: FOUNDATIONS(),
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });

    // Tick at 16ms intervals (~60fps) up to 60 seconds — far more than the
    // physics need to clear all particles. The simulation must end well
    // before then.
    let now = 0;
    let safety = 0;
    while (f.isActive && safety < 4000) {
      now += 16;
      f.tick(now);
      safety++;
    }
    expect(f.isActive).toBe(false);
    expect(f.getParticles()).toHaveLength(0);
    // 19 cards across the four foundations should all have been launched.
    expect(f.getLaunchedIds().size).toBe(19);
  });

  it("biases horizontal velocity away from the board center", () => {
    const f = new WinFinale(() => 0.5); // mid-magnitude vx for predictability
    f.start({
      foundations: [
        { x: 50, y: 10, cards: ["clubs-1" as CardId] }, // left of center
        { x: 700, y: 10, cards: ["spades-1" as CardId] }, // right of center
      ],
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    // First tick launches the first card (clubs-1).
    f.tick(1000);
    // Advance well past one launch interval so the second card spawns too.
    f.tick(1000 + WIN_FINALE_PHYSICS.launchIntervalMs + 10);
    const particles = f.getParticles();
    expect(particles.length).toBeGreaterThanOrEqual(2);
    const left = particles.find((p) => p.cardId === "clubs-1");
    const right = particles.find((p) => p.cardId === "spades-1");
    expect(left?.vx).toBeLessThan(0);
    expect(right?.vx).toBeGreaterThan(0);
  });

  it("applies gravity (vy increases downward over time)", () => {
    const f = new WinFinale(() => 0.5);
    f.start({
      foundations: [
        { x: 400, y: 10, cards: ["clubs-1" as CardId] },
      ],
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    f.tick(1000); // launches the card
    const v0 = f.getParticles()[0].vy;
    f.tick(1100); // 100ms later
    const v1 = f.getParticles()[0]?.vy;
    expect(v1).toBeGreaterThan(v0); // gravity pulls "down" → vy increases
  });

  it("stop() clears all state and deactivates", () => {
    const f = new WinFinale(fixedRng());
    f.start({
      foundations: FOUNDATIONS(),
      boardW: 800,
      boardH: 600,
      cardW: 70,
      cardH: 100,
    });
    f.tick(1000);
    expect(f.getLaunchedIds().size).toBeGreaterThan(0);
    f.stop();
    expect(f.isActive).toBe(false);
    expect(f.getParticles()).toHaveLength(0);
    expect(f.getLaunchedIds().size).toBe(0);
  });
});

describe("WinFinale physics constants", () => {
  it("has gravity, restitution and launch interval defined", () => {
    expect(WIN_FINALE_PHYSICS.gravity).toBeGreaterThan(0);
    expect(WIN_FINALE_PHYSICS.restitution).toBeGreaterThan(0);
    expect(WIN_FINALE_PHYSICS.restitution).toBeLessThan(1);
    expect(WIN_FINALE_PHYSICS.launchIntervalMs).toBeGreaterThan(0);
  });
});
