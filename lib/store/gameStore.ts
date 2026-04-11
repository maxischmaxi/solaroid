"use client";

import { create } from "zustand";
import { dealKlondike } from "@/lib/game/deal";
import {
  findBestDestination,
  isLegalMove,
  tryApplyMove,
} from "@/lib/game/moves";
import { pickNextAutoMove } from "@/lib/game/autoComplete";
import { canAutoComplete, isWon } from "@/lib/game/win";
import { finalScore } from "@/lib/game/scoring";
import {
  Settings,
  Stats,
  defaultSettings,
  defaultStats,
  loadCurrentGame,
  loadSettings,
  loadStats,
  saveCurrentGame,
  saveSettings,
  saveStats,
} from "@/lib/persistence/storage";
import type {
  CardId,
  DrawMode,
  GameState,
  MoveIntent,
  PileId,
} from "@/lib/game/types";

interface GameStore {
  game: GameState;
  history: GameState[];
  settings: Settings;
  stats: Stats;
  hydrated: boolean;
  autoCompleteRunning: boolean;

  newGame: (opts?: { seed?: string; drawMode?: DrawMode }) => void;
  dispatchMove: (intent: MoveIntent) => boolean;
  drawFromStock: () => void;
  recycleWaste: () => void;
  undo: () => void;
  autoComplete: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  resetStats: () => void;
  hydrate: () => void;

  // Selectors / convenience
  canUndo: () => boolean;
  canAutoComplete: () => boolean;
  findBestDestination: (from: PileId, cardId: CardId) => PileId | null;
  isLegalMove: (intent: MoveIntent) => boolean;

  // Internal
  _recordWin: () => void;
}

const initialGame = (drawMode: DrawMode = 1): GameState =>
  dealKlondike("ssr-placeholder", drawMode);

export const useGameStore = create<GameStore>((set, get) => ({
  game: initialGame(),
  history: [],
  settings: defaultSettings,
  stats: defaultStats,
  hydrated: false,
  autoCompleteRunning: false,

  newGame: (opts) => {
    const drawMode = opts?.drawMode ?? get().settings.drawMode;
    const game = dealKlondike(opts?.seed, drawMode);
    set({ game, history: [] });
    saveCurrentGame(game, []);
    // Increment gamesPlayed lazily — we count a game as played the first time
    // a player completes or abandons it. For simplicity, we count on newGame.
    const stats: Stats = {
      ...get().stats,
      gamesPlayed: get().stats.gamesPlayed + 1,
    };
    set({ stats });
    saveStats(stats);
  },

  dispatchMove: (intent) => {
    const { game, history } = get();
    const result = tryApplyMove(game, intent);
    if (!result.ok) return false;
    const next = result.state;
    const nextHistory = [...history, game];
    set({ game: next, history: nextHistory });
    saveCurrentGame(next, nextHistory);

    if (next.status === "won") {
      get()._recordWin();
    }
    return true;
  },

  drawFromStock: () => {
    get().dispatchMove({ kind: "draw" });
  },

  recycleWaste: () => {
    get().dispatchMove({ kind: "recycle" });
  },

  undo: () => {
    const { history } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    set({ game: prev, history: newHistory });
    saveCurrentGame(prev, newHistory);
  },

  autoComplete: async () => {
    if (get().autoCompleteRunning) return;
    set({ autoCompleteRunning: true });
    // Push a single snapshot so undo rewinds the entire auto-complete.
    const { game, history } = get();
    if (!canAutoComplete(game)) {
      set({ autoCompleteRunning: false });
      return;
    }
    set({ history: [...history, game] });

    while (!isWon(get().game)) {
      const intent = pickNextAutoMove(get().game);
      if (!intent) break;
      // 80ms stagger between moves for the visual cascade.
      await new Promise((resolve) => setTimeout(resolve, 80));
      const cur = get().game;
      const result = tryApplyMove(cur, intent);
      if (!result.ok) break;
      // Note: do NOT push individual history entries during auto-complete.
      const dispatch = () => set({ game: result.state });
      if (
        typeof document !== "undefined" &&
        "startViewTransition" in document
      ) {
        const docWithVT = document as Document & {
          startViewTransition?: (cb: () => void) => { finished: Promise<void> };
        };
        const transition = docWithVT.startViewTransition?.(dispatch);
        if (transition) {
          await transition.finished.catch(() => undefined);
        } else {
          dispatch();
        }
      } else {
        dispatch();
      }
    }

    saveCurrentGame(get().game, get().history);
    if (get().game.status === "won" || isWon(get().game)) {
      // Mark won if not already.
      if (get().game.status !== "won") {
        set({ game: { ...get().game, status: "won" } });
      }
      get()._recordWin();
    }
    set({ autoCompleteRunning: false });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    saveSettings(next);
  },

  resetStats: () => {
    set({ stats: defaultStats });
    saveStats(defaultStats);
  },

  hydrate: () => {
    const settings = loadSettings();
    const stats = loadStats();
    const persisted = loadCurrentGame();
    if (persisted) {
      set({
        game: persisted.game,
        history: persisted.history,
        settings,
        stats,
        hydrated: true,
      });
    } else {
      // No saved game → start a fresh one with the loaded drawMode.
      const game = dealKlondike(undefined, settings.drawMode);
      set({
        game,
        history: [],
        settings,
        stats,
        hydrated: true,
      });
    }
  },

  canUndo: () => get().history.length > 0,
  canAutoComplete: () => canAutoComplete(get().game),
  findBestDestination: (from, cardId) =>
    findBestDestination(get().game, from, cardId),
  isLegalMove: (intent) => isLegalMove(get().game, intent),

  // Internal — not exposed in the public interface but accessible via getState
  // for actions defined above.
  _recordWin: () => {
    const game = get().game;
    if (game.status !== "won") return;
    const elapsedMs = game.startedAt ? Date.now() - game.startedAt : 0;
    const final = finalScore(game.score, elapsedMs);
    const prev = get().stats;
    const stats: Stats = {
      ...prev,
      gamesWon: prev.gamesWon + 1,
      bestTimeMs:
        prev.bestTimeMs === null || elapsedMs < prev.bestTimeMs
          ? elapsedMs
          : prev.bestTimeMs,
      bestScore:
        prev.bestScore === null || final > prev.bestScore ? final : prev.bestScore,
      currentStreak: prev.currentStreak + 1,
      longestStreak: Math.max(prev.longestStreak, prev.currentStreak + 1),
    };
    set({ stats });
    saveStats(stats);
  },
}));

