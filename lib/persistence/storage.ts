// localStorage persistence for settings, stats, and current game.
// All loads return defaults on first run / parse failure / SSR.

import type { DrawMode, GameState } from "@/lib/game/types";

const SETTINGS_KEY = "solitaer:settings:v1";
const STATS_KEY = "solitaer:stats:v1";
const GAME_KEY = "solitaer:currentGame:v1";

export interface Settings {
  drawMode: DrawMode;
  autoCompleteEnabled: boolean;
}

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimeMs: number | null;
  bestScore: number | null;
  currentStreak: number;
  longestStreak: number;
}

export interface PersistedGame {
  game: GameState;
  history: GameState[];
}

export const defaultSettings: Settings = {
  drawMode: 1,
  autoCompleteEnabled: true,
};

export const defaultStats: Stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  bestTimeMs: null,
  bestScore: null,
  currentStreak: 0,
  longestStreak: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeParse<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface Versioned<T> {
  version: 1;
  data: T;
}

function read<T>(key: string): T | null {
  if (!isBrowser()) return null;
  const wrapper = safeParse<Versioned<T>>(localStorage.getItem(key));
  if (!wrapper || wrapper.version !== 1) return null;
  return wrapper.data;
}

function write<T>(key: string, data: T): void {
  if (!isBrowser()) return;
  try {
    const wrapper: Versioned<T> = { version: 1, data };
    localStorage.setItem(key, JSON.stringify(wrapper));
  } catch {
    // Quota exceeded or storage disabled — silently no-op.
  }
}

export function loadSettings(): Settings {
  return { ...defaultSettings, ...(read<Settings>(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

export function loadStats(): Stats {
  return { ...defaultStats, ...(read<Stats>(STATS_KEY) ?? {}) };
}

export function saveStats(s: Stats): void {
  write(STATS_KEY, s);
}

export function loadCurrentGame(): PersistedGame | null {
  return read<PersistedGame>(GAME_KEY);
}

export function saveCurrentGame(game: GameState, history: GameState[]): void {
  write(GAME_KEY, { game, history });
}

export function clearCurrentGame(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    /* no-op */
  }
}
