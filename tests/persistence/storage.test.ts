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
    const out = migrateAndValidate(1, { gamesPlayed: 5 }, statsConfig);
    expect(out).not.toBeNull();
    expect(out!.gamesPlayed).toBe(5);
    expect(out!.gamesWon).toBe(defaultStats.gamesWon);
    expect(out!.currentStreak).toBe(defaultStats.currentStreak);
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
