"use client";

import { create } from "zustand";
import { dealKlondike } from "@/lib/game/deal";
import {
  findBestDestination,
  isLegalMove,
  tryApplyMove,
} from "@/lib/game/moves";
import { pickNextAutoMove } from "@/lib/game/autoComplete";
import { findHint, type Hint } from "@/lib/game/hints";
import { canAutoComplete, isWon } from "@/lib/game/win";
import { finalScore } from "@/lib/game/scoring";
import { dailySeed, findWinnableSeed } from "@/lib/game/solve";
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
  DealType,
  DrawMode,
  GameState,
  MoveIntent,
  PileId,
} from "@/lib/game/types";

export type { DealType };

export interface ActiveHint {
  hint: Hint;
  /** Wall-clock millis when the hint was requested. */
  startedAt: number;
  /** Wall-clock millis after which the canvas hides the overlay. */
  expiresAt: number;
}

interface GameStore {
  game: GameState;
  history: GameState[];
  settings: Settings;
  stats: Stats;
  hydrated: boolean;
  autoCompleteRunning: boolean;
  // Set when an auto-complete attempt bailed without winning (e.g. a draw-3
  // cycle with no playable waste top). Prevents the GameShell effect from
  // re-triggering the same failing run; cleared on any user-initiated move.
  autoCompleteFailed: boolean;
  // True while the canvas is playing the win-finale particle cascade. The
  // CanvasBoard owns the simulation and clears the flag via finishWinFinale
  // when the last particle leaves the screen.
  winFinalePlaying: boolean;
  // Active hint preview from the Tipp button. The CanvasBoard renders this
  // as a pulsing ring + ghost-card animation and clears it via clearHint
  // once `expiresAt` is reached.
  hint: ActiveHint | null;
  // Set when requestHint runs against a state with no possible move.
  // Drives the GameOverModal in GameShell.
  gameOverOpen: boolean;

  newGame: (opts?: {
    seed?: string;
    drawMode?: DrawMode;
    dealType?: DealType;
  }) => void;
  dispatchMove: (intent: MoveIntent) => boolean;
  drawFromStock: () => void;
  recycleWaste: () => void;
  undo: () => void;
  autoComplete: () => Promise<void>;
  finishWinFinale: () => void;
  requestHint: () => void;
  clearHint: () => void;
  closeGameOver: () => void;
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
  autoCompleteFailed: false,
  winFinalePlaying: false,
  hint: null,
  gameOverOpen: false,

  newGame: (opts) => {
    const drawMode = opts?.drawMode ?? get().settings.drawMode;
    const dealType = opts?.dealType ?? get().settings.dealType;

    let seed: string | undefined = opts?.seed;
    if (dealType === "winnable") {
      const found = findWinnableSeed(drawMode);
      if (found) seed = found;
      // If no winnable seed found (very unlikely), fall through to random.
    } else if (dealType === "replay") {
      seed = get().game.seed;
    } else if (dealType === "daily") {
      seed = dailySeed(drawMode);
    }

    // Persist the selected deal type (but "replay" is transient — keep the
    // underlying mode so the next plain "Neu" click uses the right type).
    const persistedDealType = dealType === "replay" ? get().settings.dealType : dealType;
    const nextSettings = { ...get().settings, drawMode, dealType: persistedDealType };
    set({ settings: nextSettings });
    saveSettings(nextSettings);

    const game = dealKlondike(seed, drawMode);
    set({
      game,
      history: [],
      autoCompleteFailed: false,
      winFinalePlaying: false,
      hint: null,
      gameOverOpen: false,
    });
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
    // Any user move clears a previous auto-complete-failure flag — the player
    // may have unblocked the position manually. Also dismiss any active hint
    // overlay since the suggested move may no longer apply.
    set({
      game: next,
      history: nextHistory,
      autoCompleteFailed: false,
      hint: null,
    });
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
    set({
      game: prev,
      history: newHistory,
      autoCompleteFailed: false,
      hint: null,
    });
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

    const totalFoundationCards = (s: GameState): number =>
      s.foundations.reduce((sum, f) => sum + f.cards.length, 0);

    // Greedy stuck detector: if a complete stock cycle (next recycle) yielded
    // no foundation progress, the same cycle would just repeat. Bail and
    // surface the failure so the UI doesn't auto-retrigger forever.
    let progressedSinceLastRecycle = true;
    // The canvas scheduler runs the visible cascade animation; we just commit
    // the moves with a small inter-step pause so each animation has time to
    // play out before the next tween starts.
    while (!isWon(get().game)) {
      const intent = pickNextAutoMove(get().game);
      if (!intent) break;
      if (intent.kind === "recycle" && !progressedSinceLastRecycle) break;
      const cur = get().game;
      const before = totalFoundationCards(cur);
      const result = tryApplyMove(cur, intent);
      if (!result.ok) break;
      set({ game: result.state });
      const after = totalFoundationCards(result.state);
      if (after > before) {
        progressedSinceLastRecycle = true;
      } else if (intent.kind === "recycle") {
        progressedSinceLastRecycle = false;
      }
      // Wait roughly one tween duration so the cascade reads as a sequence
      // rather than a single instantaneous mutation.
      await new Promise((resolve) => setTimeout(resolve, 90));
    }

    saveCurrentGame(get().game, get().history);
    if (get().game.status === "won" || isWon(get().game)) {
      // Mark won if not already.
      if (get().game.status !== "won") {
        set({ game: { ...get().game, status: "won" } });
      }
      get()._recordWin();
      set({ autoCompleteFailed: false });
    } else {
      // Loop bailed without a win — record so the GameShell effect doesn't
      // immediately retry the same dead-end run.
      set({ autoCompleteFailed: true });
    }
    set({ autoCompleteRunning: false });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    saveSettings(next);
  },

  finishWinFinale: () => {
    if (get().winFinalePlaying) set({ winFinalePlaying: false });
  },

  requestHint: () => {
    const found = findHint(get().game);
    if (!found) {
      // Truly stuck — no on-board move and stock+waste both empty.
      set({ gameOverOpen: true, hint: null });
      return;
    }
    const startedAt = Date.now();
    set({
      hint: { hint: found, startedAt, expiresAt: startedAt + 3000 },
    });
  },

  clearHint: () => {
    if (get().hint) set({ hint: null });
  },

  closeGameOver: () => {
    if (get().gameOverOpen) set({ gameOverOpen: false });
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
        autoCompleteFailed: false,
        winFinalePlaying: false,
        hint: null,
        gameOverOpen: false,
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
        autoCompleteFailed: false,
        winFinalePlaying: false,
        hint: null,
        gameOverOpen: false,
      });
    }
  },

  canUndo: () => get().history.length > 0,
  canAutoComplete: () =>
    !get().autoCompleteFailed && canAutoComplete(get().game),
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
    // Trigger the canvas win finale. The CanvasBoard observer will short-
    // circuit it if prefers-reduced-motion is enabled.
    set({ stats, winFinalePlaying: true });
    saveStats(stats);
  },
}));

