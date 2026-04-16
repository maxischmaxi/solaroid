// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { dealKlondike } from "@/lib/game/deal";
import { defaultSettings, defaultStats } from "@/lib/persistence/storage";
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
  it("pause is a no-op on an idle game (no first move yet)", () => {
    useGameStore.getState().pause();
    expect(useGameStore.getState().game.status).toBe("idle");
  });

  it("pause after a move flips status and freezes startedAt", () => {
    useGameStore.getState().drawFromStock();
    expect(useGameStore.getState().game.status).toBe("playing");
    useGameStore.getState().pause();
    const game = useGameStore.getState().game;
    expect(game.status).toBe("paused");
    expect(game.startedAt).toBeNull();
    expect(game.accumulatedMs).toBeGreaterThanOrEqual(0);
  });

  it("togglePause cycles playing ↔ paused", () => {
    useGameStore.getState().drawFromStock();
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().game.status).toBe("paused");
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().game.status).toBe("playing");
  });

  it("moves during pause are rejected by the store dispatcher", () => {
    useGameStore.getState().drawFromStock();
    useGameStore.getState().pause();
    const before = useGameStore.getState().game;
    useGameStore.getState().drawFromStock();
    // Draw was rejected — state didn't change.
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
