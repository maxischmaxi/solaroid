// Time tracking helpers. Elapsed play time is split into a running-session
// portion (`now - startedAt`, only while status === "playing") and an
// accumulator (`accumulatedMs`) that captures every session already ended.
// Pausing drains the running session into the accumulator; resuming starts
// a new running session. The combined total is what the UI and scoring use.

import type { ApplyResult, GameState } from "./types";

/** Total play time in milliseconds, across running + all prior sessions. */
export function elapsedMs(game: GameState, nowMs: number): number {
  const running =
    game.status === "playing" && game.startedAt !== null
      ? Math.max(0, nowMs - game.startedAt)
      : 0;
  return game.accumulatedMs + running;
}

/** Pause a running game. No-op (rejected) if the game isn't actively playing. */
export function pauseGame(game: GameState, nowMs: number): ApplyResult {
  if (game.status !== "playing") {
    return { ok: false, reason: "not-playing" };
  }
  const session = game.startedAt !== null ? Math.max(0, nowMs - game.startedAt) : 0;
  return {
    ok: true,
    state: {
      ...game,
      accumulatedMs: game.accumulatedMs + session,
      startedAt: null,
      status: "paused",
    },
  };
}

/** Resume a paused game. No-op if the game isn't paused. */
export function resumeGame(game: GameState, nowMs: number): ApplyResult {
  if (game.status !== "paused") {
    return { ok: false, reason: "not-paused" };
  }
  return {
    ok: true,
    state: {
      ...game,
      startedAt: nowMs,
      status: "playing",
    },
  };
}
