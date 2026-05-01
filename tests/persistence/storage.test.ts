import { describe, it, expect } from "vitest";
import {
  defaultSettings,
  defaultStats,
  gameConfig,
  migrateAndValidate,
  settingsConfig,
  statsConfig,
  type Settings,
} from "@/lib/persistence/storage";
import { dealKlondike } from "@/lib/game/deal";

describe("migrateAndValidate — settings", () => {
  it("returns the validated object for a current-version payload", () => {
    const raw = { ...defaultSettings, theme: "neon" };
    const out = migrateAndValidate(1, raw, settingsConfig);
    expect(out).not.toBeNull();
    expect(out!.theme).toBe("neon");
  });

  it("rejects a future version (the caller falls back to defaults)", () => {
    const out = migrateAndValidate(9999, {}, settingsConfig);
    expect(out).toBeNull();
  });

  it("rejects a non-numeric version", () => {
    const out = migrateAndValidate("1", {}, settingsConfig);
    expect(out).toBeNull();
  });

  it("fills missing fields from defaults via spread-merge", () => {
    // Simulates a pre-redealLimit save: older schema with a subset of fields.
    const legacy = {
      drawMode: 3,
      autoCompleteEnabled: true,
      dealType: "random",
      theme: "classic",
      // no redealLimit
    };
    const out = migrateAndValidate(1, legacy, settingsConfig);
    expect(out).not.toBeNull();
    expect(out!.drawMode).toBe(3);
    expect(out!.redealLimit).toBe(defaultSettings.redealLimit);
  });

  it("rejects a payload that isn't an object", () => {
    expect(migrateAndValidate(1, "banana", settingsConfig)).toBeNull();
    expect(migrateAndValidate(1, null, settingsConfig)).toBeNull();
    expect(migrateAndValidate(1, 42, settingsConfig)).toBeNull();
  });
});

describe("migrateAndValidate — stats", () => {
  it("tolerates a partial stats object by merging with defaults", () => {
    const out = migrateAndValidate(
      statsConfig.currentVersion,
      { gamesPlayed: 5 },
      statsConfig,
    );
    expect(out).not.toBeNull();
    expect(out!.gamesPlayed).toBe(5);
    expect(out!.gamesWon).toBe(defaultStats.gamesWon);
    expect(out!.currentStreak).toBe(defaultStats.currentStreak);
  });

  it("migrates v1 saves by adding empty byMode/history/totalPlayTimeMs", () => {
    // Pre-v2 save: just the original aggregate fields.
    const v1 = {
      gamesPlayed: 12,
      gamesWon: 7,
      bestTimeMs: 90_000,
      bestScore: 4_500,
      currentStreak: 2,
      longestStreak: 5,
    };
    const out = migrateAndValidate(1, v1, statsConfig);
    expect(out).not.toBeNull();
    expect(out!.gamesPlayed).toBe(12);
    expect(out!.gamesWon).toBe(7);
    expect(out!.bestTimeMs).toBe(90_000);
    expect(out!.byMode[1].played).toBe(0);
    expect(out!.byMode[3].played).toBe(0);
    expect(out!.history).toEqual([]);
    expect(out!.totalPlayTimeMs).toBe(0);
  });

  it("normalizes history entries and drops corrupted ones", () => {
    const v2 = {
      ...defaultStats,
      history: [
        // valid
        {
          endedAt: 1,
          drawMode: 1,
          dealType: "random",
          durationMs: 60_000,
          score: 200,
          finalScore: 350,
          moves: 70,
          won: true,
        },
        // missing required fields → dropped
        { endedAt: 2 },
        // string drawMode → dropped
        {
          endedAt: 3,
          drawMode: "1",
          durationMs: 1,
          score: 0,
          moves: 0,
          won: false,
        },
      ],
    };
    const out = migrateAndValidate(statsConfig.currentVersion, v2, statsConfig);
    expect(out).not.toBeNull();
    expect(out!.history).toHaveLength(1);
    expect(out!.history[0].drawMode).toBe(1);
  });

  it("caps the persisted history length at STATS_HISTORY_MAX", () => {
    const tooMany = Array.from({ length: 250 }, (_, i) => ({
      endedAt: i,
      drawMode: 1 as const,
      dealType: "random" as const,
      durationMs: 60_000,
      score: i,
      finalScore: i,
      moves: 1,
      won: i % 2 === 0,
    }));
    const out = migrateAndValidate(
      statsConfig.currentVersion,
      { ...defaultStats, history: tooMany },
      statsConfig,
    );
    expect(out!.history.length).toBeLessThanOrEqual(100);
    // Latest entries are kept (we slice from the tail).
    expect(out!.history[out!.history.length - 1].endedAt).toBe(249);
  });
});

describe("migrateAndValidate — game", () => {
  it("accepts a freshly-dealt game", () => {
    const game = dealKlondike("seed-1", 1);
    const out = migrateAndValidate(1, { game, history: [] }, gameConfig);
    expect(out).not.toBeNull();
    expect(out!.game.seed).toBe("seed-1");
    expect(out!.history).toHaveLength(0);
  });

  it("fills in redealLimit=null for pre-feature saves", () => {
    const game = dealKlondike("seed-1", 1);
    // Simulate an older save that didn't have redealLimit.
    const legacyGame = { ...game } as Record<string, unknown>;
    delete legacyGame.redealLimit;
    const out = migrateAndValidate(
      1,
      { game: legacyGame, history: [legacyGame] },
      gameConfig,
    );
    expect(out).not.toBeNull();
    expect(out!.game.redealLimit).toBeNull();
    expect(out!.history[0].redealLimit).toBeNull();
  });

  it("rejects a corrupt history entry (everything-or-nothing)", () => {
    const game = dealKlondike("seed-1", 1);
    const out = migrateAndValidate(
      1,
      { game, history: [game, "not-a-game"] },
      gameConfig,
    );
    expect(out).toBeNull();
  });

  it("treats a missing history as empty", () => {
    const game = dealKlondike("seed-1", 1);
    const out = migrateAndValidate(1, { game }, gameConfig);
    expect(out).not.toBeNull();
    expect(out!.history).toEqual([]);
  });
});

describe("migrateAndValidate — migration chain", () => {
  it("walks registered migrators from the source version to current", () => {
    // Build a 3-step migration chain in isolation to exercise the loop.
    const cfg = {
      currentVersion: 3,
      migrations: {
        1: (old: unknown) => {
          const o = old as { a: number };
          return { a: o.a, b: o.a * 2 };
        },
        2: (old: unknown) => {
          const o = old as { a: number; b: number };
          return { a: o.a, b: o.b, c: o.a + o.b };
        },
      },
      validate: (data: unknown): { a: number; b: number; c: number } | null => {
        if (
          typeof data !== "object" ||
          data === null ||
          typeof (data as { a?: unknown }).a !== "number" ||
          typeof (data as { b?: unknown }).b !== "number" ||
          typeof (data as { c?: unknown }).c !== "number"
        ) {
          return null;
        }
        return data as { a: number; b: number; c: number };
      },
    } as const;

    const out = migrateAndValidate(1, { a: 10 }, cfg);
    expect(out).toEqual({ a: 10, b: 20, c: 30 });
  });

  it("rejects when a needed migrator is missing", () => {
    const cfg = {
      currentVersion: 3,
      migrations: { 1: (d: unknown) => d }, // missing 2→3
      validate: (data: unknown) => data as { x?: number } | null,
    };
    expect(migrateAndValidate(1, { x: 1 }, cfg)).toBeNull();
  });

  it("rejects when a migrator throws", () => {
    const cfg = {
      currentVersion: 2,
      migrations: {
        1: () => {
          throw new Error("boom");
        },
      },
      validate: (data: unknown) => data as { x?: number } | null,
    };
    expect(migrateAndValidate(1, { x: 1 }, cfg)).toBeNull();
  });
});

describe("settings validator — type narrowing", () => {
  it("always returns all required Settings fields", () => {
    const out = migrateAndValidate<Settings>(1, {}, settingsConfig);
    expect(out).not.toBeNull();
    expect(Object.keys(out!).sort()).toEqual(
      Object.keys(defaultSettings).sort(),
    );
  });
});
