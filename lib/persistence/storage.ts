// localStorage persistence for settings, stats, and current game.
//
// Every persisted value is stored as `{ version: N, data: T }`. Reads run
// the raw payload through a *migration chain* — an ordered list of pure
// upgrade functions keyed by the source version — before handing it to a
// validator that coerces the result into the current shape (or rejects it,
// in which case the caller gets defaults).
//
// Adding a new field with a safe default does NOT require a version bump;
// the validator's spread-merge fills it in automatically. Bump the version
// when a change is *semantically incompatible* — field renames, shape
// changes, unit changes, etc. — and register a migrator so existing saves
// survive the upgrade instead of silently reverting to defaults.

import type { DealType, DrawMode, GameState, ThemeId } from "@/lib/game/types";

const SETTINGS_KEY = "solitaer:settings:v1";
const STATS_KEY = "solitaer:stats:v1";
const GAME_KEY = "solitaer:currentGame:v1";

/** Cap the per-stat history at this size so the localStorage payload doesn't
 *  grow unbounded. The charts only ever consume the last N entries anyway. */
export const STATS_HISTORY_MAX = 100;

export interface Settings {
  drawMode: DrawMode;
  autoCompleteEnabled: boolean;
  dealType: DealType;
  theme: ThemeId;
  // Recycles allowed per game. `null` = unlimited. Common presets: 0 (Vegas,
  // single pass), 2 (classic Klondike, 3 passes), null (Microsoft, unlimited).
  redealLimit: number | null;
}

/** Per-draw-mode aggregate so the UI can compare Draw 1 vs Draw 3. */
export interface PerModeStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  bestScore: number | null;
}

/** A single completed (won OR abandoned/lost) game. The charts read these. */
export interface CompletedGame {
  /** Wall-clock ms when this game ended. */
  endedAt: number;
  drawMode: DrawMode;
  dealType: DealType;
  durationMs: number;
  /** Raw board score at end (no time bonus). */
  score: number;
  /** With Microsoft time bonus on a win, otherwise equals `score`. */
  finalScore: number;
  moves: number;
  won: boolean;
}

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimeMs: number | null;
  bestScore: number | null;
  currentStreak: number;
  longestStreak: number;
  /** Per-draw-mode breakdown so we can compare Draw 1 vs Draw 3. */
  byMode: Record<DrawMode, PerModeStats>;
  /** Most recent first; capped at STATS_HISTORY_MAX. */
  history: CompletedGame[];
  /** Sum of every completed game's durationMs. */
  totalPlayTimeMs: number;
}

export interface PersistedGame {
  game: GameState;
  history: GameState[];
}

export const defaultSettings: Settings = {
  drawMode: 1,
  autoCompleteEnabled: true,
  theme: "classic",
  dealType: "random",
  redealLimit: null,
};

function emptyPerMode(): PerModeStats {
  return { played: 0, won: 0, bestTimeMs: null, bestScore: null };
}

/** Factory for a pristine Stats object. Returns a fresh sub-object tree on
 *  every call so callers (newGame, resetStats) don't accidentally share
 *  references. */
export function freshStats(): Stats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    bestTimeMs: null,
    bestScore: null,
    currentStreak: 0,
    longestStreak: 0,
    byMode: { 1: emptyPerMode(), 3: emptyPerMode() },
    history: [],
    totalPlayTimeMs: 0,
  };
}

export const defaultStats: Stats = freshStats();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/* ---------- Versioned-payload plumbing ---------- */

/** Migrates data from version N to N+1. May throw; caller catches. */
type Migrator = (old: unknown) => unknown;

interface VersionedConfig<T> {
  currentVersion: number;
  /** Migrations[i] upgrades version `i` → `i+1`. Must cover [1..currentVersion-1]. */
  migrations: Readonly<Record<number, Migrator>>;
  /** Final validator: coerce arbitrary data into T, or reject with null. */
  validate: (data: unknown) => T | null;
}

/**
 * Pure migration+validation pipeline. Exported so the test suite can exercise
 * migrator chains without touching localStorage.
 *
 * Returns the validated T on success, or null if:
 *  * the payload doesn't have a numeric version,
 *  * the version is newer than we understand,
 *  * any registered migrator throws,
 *  * a needed migrator is missing,
 *  * the validator rejects the result.
 */
export function migrateAndValidate<T>(
  rawVersion: unknown,
  rawData: unknown,
  config: VersionedConfig<T>,
): T | null {
  if (typeof rawVersion !== "number" || !Number.isFinite(rawVersion)) return null;
  // Refuse to downgrade: a newer app wrote this and we don't know how to
  // interpret its shape. Caller falls back to defaults — better than
  // mangling the future-self's data.
  if (rawVersion > config.currentVersion) return null;

  let version = rawVersion;
  let data = rawData;
  while (version < config.currentVersion) {
    const migrate = config.migrations[version];
    if (!migrate) return null;
    try {
      data = migrate(data);
    } catch {
      return null;
    }
    version++;
  }
  return config.validate(data);
}

function loadVersioned<T>(
  key: string,
  config: VersionedConfig<T>,
): T | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  return migrateAndValidate(parsed.version, parsed.data, config);
}

function saveVersioned<T>(
  key: string,
  version: number,
  data: T,
): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify({ version, data }));
  } catch {
    // Quota exceeded or storage disabled — silently no-op.
  }
}

/* ---------- Settings ---------- */

export const settingsConfig: VersionedConfig<Settings> = {
  currentVersion: 1,
  // No migrations needed yet. Example for a future v1 → v2 rename:
  //   1: (old) => isPlainObject(old) && "autoCompleteEnabled" in old
  //     ? { ...old, autoPlay: old.autoCompleteEnabled, autoCompleteEnabled: undefined }
  //     : old,
  migrations: {},
  validate: (data) => {
    if (!isPlainObject(data)) return null;
    // Spread-merge tolerates extra/missing fields. Any new primitive field
    // added to `defaultSettings` is picked up automatically without bumping
    // the version; only semantic changes require a migrator.
    return { ...defaultSettings, ...data } as Settings;
  },
};

export function loadSettings(): Settings {
  return loadVersioned(SETTINGS_KEY, settingsConfig) ?? defaultSettings;
}

export function saveSettings(s: Settings): void {
  saveVersioned(SETTINGS_KEY, settingsConfig.currentVersion, s);
}

/* ---------- Stats ---------- */

function normalizePerMode(x: unknown): PerModeStats {
  if (!isPlainObject(x)) return emptyPerMode();
  const m = x as Partial<PerModeStats>;
  return {
    played: typeof m.played === "number" ? m.played : 0,
    won: typeof m.won === "number" ? m.won : 0,
    bestTimeMs: typeof m.bestTimeMs === "number" ? m.bestTimeMs : null,
    bestScore: typeof m.bestScore === "number" ? m.bestScore : null,
  };
}

function normalizeHistory(x: unknown): CompletedGame[] {
  if (!Array.isArray(x)) return [];
  const out: CompletedGame[] = [];
  for (const entry of x) {
    if (!isPlainObject(entry)) continue;
    const e = entry as Partial<CompletedGame>;
    if (
      typeof e.endedAt !== "number" ||
      typeof e.durationMs !== "number" ||
      typeof e.score !== "number" ||
      typeof e.moves !== "number" ||
      typeof e.won !== "boolean" ||
      (e.drawMode !== 1 && e.drawMode !== 3)
    ) {
      continue;
    }
    out.push({
      endedAt: e.endedAt,
      drawMode: e.drawMode,
      dealType:
        e.dealType === "winnable" ||
        e.dealType === "replay" ||
        e.dealType === "daily"
          ? e.dealType
          : "random",
      durationMs: e.durationMs,
      score: e.score,
      finalScore: typeof e.finalScore === "number" ? e.finalScore : e.score,
      moves: e.moves,
      won: e.won,
    });
  }
  return out.slice(-STATS_HISTORY_MAX);
}

export const statsConfig: VersionedConfig<Stats> = {
  currentVersion: 2,
  migrations: {
    // v1 → v2: introduce per-mode breakdown and per-game history. Anything
    // we can't reconstruct from the old aggregate gets a safe zero/empty.
    1: (old) => {
      const o = isPlainObject(old) ? old : {};
      return {
        ...o,
        byMode: { 1: emptyPerMode(), 3: emptyPerMode() },
        history: [],
        totalPlayTimeMs: 0,
      };
    },
  },
  validate: (data) => {
    if (!isPlainObject(data)) return null;
    const fresh = freshStats();
    const byMode = isPlainObject(data.byMode) ? data.byMode : {};
    return {
      ...fresh,
      ...data,
      byMode: {
        1: normalizePerMode((byMode as Record<string, unknown>)[1]),
        3: normalizePerMode((byMode as Record<string, unknown>)[3]),
      },
      history: normalizeHistory(data.history),
      totalPlayTimeMs:
        typeof data.totalPlayTimeMs === "number" ? data.totalPlayTimeMs : 0,
    } as Stats;
  },
};

export function loadStats(): Stats {
  return loadVersioned(STATS_KEY, statsConfig) ?? defaultStats;
}

export function saveStats(s: Stats): void {
  saveVersioned(STATS_KEY, statsConfig.currentVersion, s);
}

/* ---------- Current game ---------- */

function normalizeGameState(g: unknown): GameState | null {
  if (!isPlainObject(g)) return null;
  // Tolerate saves written before `redealLimit` was introduced.
  const withLimit =
    "redealLimit" in g ? g : { ...g, redealLimit: null };
  // Tolerate saves written before pause/accumulatedMs was introduced.
  const withAccum =
    "accumulatedMs" in withLimit
      ? withLimit
      : { ...withLimit, accumulatedMs: 0 };
  return withAccum as unknown as GameState;
}

export const gameConfig: VersionedConfig<PersistedGame> = {
  currentVersion: 1,
  migrations: {},
  validate: (data) => {
    if (!isPlainObject(data)) return null;
    const game = normalizeGameState(data.game);
    if (!game) return null;
    const rawHistory = Array.isArray(data.history) ? data.history : [];
    const history: GameState[] = [];
    for (const entry of rawHistory) {
      const g = normalizeGameState(entry);
      if (!g) return null;
      history.push(g);
    }
    return { game, history };
  },
};

export function loadCurrentGame(): PersistedGame | null {
  return loadVersioned(GAME_KEY, gameConfig);
}

export function saveCurrentGame(game: GameState, history: GameState[]): void {
  saveVersioned(GAME_KEY, gameConfig.currentVersion, { game, history });
}

export function clearCurrentGame(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    /* no-op */
  }
}
