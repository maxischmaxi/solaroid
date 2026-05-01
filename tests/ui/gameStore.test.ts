// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { defaultSettings, defaultStats, freshStats } from "@/lib/persistence/storage";
import { useGameStore } from "@/lib/store/gameStore";

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}): void {
  useGameStore.setState({
    game: dealKlondike("test-seed", 1),
    history: [],
    settings: { ...defaultSettings },
    stats: { ...defaultStats },
    hydrated: true,
    autoCompleteRunning: false,
    autoCompleteFailed: false,
    winFinalePlaying: false,
    hint: null,
    gameOverOpen: false,
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe("streak accounting around newGame", () => {
  it("preserves streak when the previous game was won", () => {
    resetStore({
      game: { ...useGameStore.getState().game, status: "won" },
      stats: { ...defaultStats, currentStreak: 2, longestStreak: 2 },
    });
    useGameStore.getState().newGame();
    const stats = useGameStore.getState().stats;
    expect(stats.currentStreak).toBe(2);
    expect(stats.gamesPlayed).toBe(1);
  });

  it("resets streak to zero when a playing game is abandoned", () => {
    resetStore({
      game: { ...useGameStore.getState().game, status: "playing" },
      stats: { ...defaultStats, currentStreak: 3, longestStreak: 5 },
    });
    useGameStore.getState().newGame();
    const stats = useGameStore.getState().stats;
    expect(stats.currentStreak).toBe(0);
    // Longest should NOT be lost.
    expect(stats.longestStreak).toBe(5);
  });

  it("leaves streak alone when the previous game was still idle", () => {
    resetStore({
      stats: { ...defaultStats, currentStreak: 4, longestStreak: 4 },
    });
    useGameStore.getState().newGame();
    expect(useGameStore.getState().stats.currentStreak).toBe(4);
  });
});

describe("stats history accounting", () => {
  it("appends an abandoned-loss entry when a played game is replaced", () => {
    resetStore({
      game: {
        ...useGameStore.getState().game,
        status: "playing",
        startedAt: Date.now() - 30_000,
        accumulatedMs: 0,
        moveCount: 5,
        score: 25,
      },
      stats: freshStats(),
    });
    useGameStore.getState().newGame();
    const stats = useGameStore.getState().stats;
    expect(stats.history).toHaveLength(1);
    expect(stats.history[0].won).toBe(false);
    expect(stats.history[0].drawMode).toBe(1);
    expect(stats.history[0].moves).toBe(5);
    expect(stats.byMode[1].played).toBe(1);
    expect(stats.byMode[1].won).toBe(0);
    expect(stats.totalPlayTimeMs).toBeGreaterThan(0);
  });

  it("does NOT append a history entry for an idle game without moves", () => {
    // Fresh deal with moveCount = 0 — user clicks "Neu" without playing.
    resetStore({ stats: freshStats() });
    useGameStore.getState().newGame();
    expect(useGameStore.getState().stats.history).toHaveLength(0);
    expect(useGameStore.getState().stats.byMode[1].played).toBe(0);
  });

  it("appends a win entry with finalScore including the time bonus", () => {
    // Build a state where a single move into foundation completes the game.
    // Mark it 'won' directly and trigger _recordWin; we don't need to
    // re-test the win detection itself here.
    const won = {
      ...useGameStore.getState().game,
      status: "won" as const,
      drawMode: 3 as const,
      startedAt: null,
      accumulatedMs: 60_000,
      moveCount: 80,
      score: 350,
    };
    resetStore({
      game: won,
      stats: freshStats(),
      settings: { ...defaultSettings, drawMode: 3, dealType: "winnable" },
    });
    // _recordWin is internal — invoke it via getState() to keep the test honest.
    (useGameStore.getState() as unknown as {
      _recordWin: () => void;
    })._recordWin();
    const stats = useGameStore.getState().stats;
    expect(stats.history).toHaveLength(1);
    expect(stats.history[0].won).toBe(true);
    expect(stats.history[0].drawMode).toBe(3);
    expect(stats.history[0].dealType).toBe("winnable");
    expect(stats.history[0].durationMs).toBe(60_000);
    expect(stats.history[0].finalScore).toBeGreaterThan(stats.history[0].score);
    expect(stats.byMode[3].played).toBe(1);
    expect(stats.byMode[3].won).toBe(1);
    expect(stats.byMode[3].bestTimeMs).toBe(60_000);
    expect(stats.byMode[1].played).toBe(0);
  });
});

describe("redealLimit is baked into the new deal", () => {
  it("picks the configured limit up from settings", () => {
    resetStore({
      settings: { ...defaultSettings, redealLimit: 2 },
    });
    useGameStore.getState().newGame({});
    expect(useGameStore.getState().game.redealLimit).toBe(2);
  });

  it("null settings produce a game with unlimited recycles", () => {
    resetStore({ settings: { ...defaultSettings, redealLimit: null } });
    useGameStore.getState().newGame({});
    expect(useGameStore.getState().game.redealLimit).toBeNull();
  });
});

describe("pause / resume via the store", () => {
  it("pause is a no-op on an idle game (no first card moved yet)", () => {
    useGameStore.getState().pause();
    expect(useGameStore.getState().game.status).toBe("idle");
  });

  it("drawing from stock does not start the timer (still idle)", () => {
    useGameStore.getState().drawFromStock();
    const game = useGameStore.getState().game;
    expect(game.status).toBe("idle");
    expect(game.startedAt).toBeNull();
  });

  it("pause after a real card move flips status and freezes startedAt", () => {
    resetStore({
      game: {
        ...useGameStore.getState().game,
        status: "playing",
        startedAt: Date.now(),
      },
    });
    useGameStore.getState().pause();
    const game = useGameStore.getState().game;
    expect(game.status).toBe("paused");
    expect(game.startedAt).toBeNull();
    expect(game.accumulatedMs).toBeGreaterThanOrEqual(0);
  });

  it("togglePause cycles playing ↔ paused", () => {
    resetStore({
      game: {
        ...useGameStore.getState().game,
        status: "playing",
        startedAt: Date.now(),
      },
    });
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().game.status).toBe("paused");
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().game.status).toBe("playing");
  });

  it("moves during pause are rejected by the store dispatcher", () => {
    resetStore({
      game: {
        ...useGameStore.getState().game,
        status: "playing",
        startedAt: Date.now(),
      },
    });
    useGameStore.getState().pause();
    const before = useGameStore.getState().game;
    useGameStore.getState().drawFromStock();
    expect(useGameStore.getState().game).toBe(before);
  });
});

describe("move + undo roundtrip", () => {
  it("draw → undo lands on the original game state", () => {
    const before = useGameStore.getState().game;
    useGameStore.getState().drawFromStock();
    expect(useGameStore.getState().history).toHaveLength(1);
    expect(useGameStore.getState().game).not.toBe(before);
    useGameStore.getState().undo();
    expect(useGameStore.getState().history).toHaveLength(0);
    // Undo returns the same snapshot we captured before.
    expect(useGameStore.getState().game).toEqual(before);
  });

  it("dispatching a move clears the active hint", () => {
    // Put a dummy hint into the store to verify it gets cleared by any move.
    useGameStore.setState({
      hint: {
        hint: { kind: "stock", action: "draw", draws: 1 },
        startedAt: Date.now(),
        expiresAt: Date.now() + 3000,
      },
    });
    useGameStore.getState().drawFromStock();
    expect(useGameStore.getState().hint).toBeNull();
  });
});
