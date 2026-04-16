import { describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { elapsedMs, pauseGame, resumeGame } from "@/lib/game/time";
import type { GameState } from "@/lib/game/types";

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error("expected ok");
  return r as Extract<T, { ok: true }>;
}

function startedGame(startedAt: number): GameState {
  return {
    ...dealKlondike("seed-1", 1),
    status: "playing",
    startedAt,
  };
}

describe("elapsedMs", () => {
  it("is zero on a fresh deal", () => {
    const game = dealKlondike("seed-1", 1);
    expect(elapsedMs(game, 123456)).toBe(0);
  });

  it("returns the running-session length while playing", () => {
    const t0 = 1_000_000;
    const game = startedGame(t0);
    expect(elapsedMs(game, t0 + 5_000)).toBe(5_000);
  });

  it("returns only the accumulator while paused", () => {
    const t0 = 1_000_000;
    const game = startedGame(t0);
    const paused = ok(pauseGame(game, t0 + 3_000)).state;
    expect(elapsedMs(paused, t0 + 10_000)).toBe(3_000);
  });

  it("clamps negative running-session gaps to zero (clock skew)", () => {
    const t0 = 1_000_000;
    const game = startedGame(t0);
    expect(elapsedMs(game, t0 - 500)).toBe(0);
  });
});

describe("pauseGame", () => {
  it("drains the running session into the accumulator", () => {
    const t0 = 1_000_000;
    const game = startedGame(t0);
    const paused = ok(pauseGame(game, t0 + 7_500)).state;
    expect(paused.status).toBe("paused");
    expect(paused.startedAt).toBeNull();
    expect(paused.accumulatedMs).toBe(7_500);
  });

  it("is a no-op when the game isn't playing", () => {
    const game = dealKlondike("seed-1", 1); // idle
    expect(pauseGame(game, 100).ok).toBe(false);
  });
});

describe("resumeGame", () => {
  it("returns a playing state with a new startedAt", () => {
    const t0 = 1_000_000;
    const played = startedGame(t0);
    const paused = ok(pauseGame(played, t0 + 2_000)).state;
    const resumed = ok(resumeGame(paused, t0 + 60_000)).state;
    expect(resumed.status).toBe("playing");
    expect(resumed.startedAt).toBe(t0 + 60_000);
    expect(resumed.accumulatedMs).toBe(2_000);
    expect(elapsedMs(resumed, t0 + 65_000)).toBe(7_000);
  });

  it("rejects when the game isn't paused", () => {
    const game = dealKlondike("seed-1", 1);
    expect(resumeGame(game, 1).ok).toBe(false);
  });
});

describe("pause/resume roundtrip", () => {
  it("cumulative elapsed time adds across sessions", () => {
    const t0 = 1_000_000;
    let game: GameState = startedGame(t0);
    game = ok(pauseGame(game, t0 + 1_000)).state; // 1s session 1
    game = ok(resumeGame(game, t0 + 10_000)).state;
    game = ok(pauseGame(game, t0 + 13_000)).state; // 3s session 2
    game = ok(resumeGame(game, t0 + 20_000)).state;
    // 4s accumulated + running portion
    expect(elapsedMs(game, t0 + 22_500)).toBe(4_000 + 2_500);
  });
});
