"use client";

import { create } from "zustand";
import { reducedMotion } from "@/lib/canvas/reducedMotion";
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
import { elapsedMs, pauseGame, resumeGame } from "@/lib/game/time";
import {
  CompletedGame,
  STATS_HISTORY_MAX,
  Settings,
  Stats,
  defaultSettings,
  defaultStats,
  freshStats,
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
  // True when the timer was auto-paused because the tab lost visibility/focus.
  // Keeps the manual "Pause" overlay hidden (the user didn't choose to pause)
  // and gates autoResume so we only un-pause games we paused ourselves.
  autoPausedByVisibility: boolean;

  newGame: (opts?: {
    seed?: string;
    drawMode?: DrawMode;
    dealType?: DealType;
  }) => void;
  dispatchMove: (intent: MoveIntent) => boolean;
  drawFromStock: () => void;
  recycleWaste: () => void;
  undo: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  autoPause: () => void;
  autoResume: () => void;
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

/**
 * Append a CompletedGame entry to the history and refresh the matching
 * per-mode aggregate. Pure: returns the next Stats object, never mutates.
 *
 * Top-level scalars (gamesPlayed/gamesWon/streaks) are NOT touched here —
 * those are managed by the actions that already control them so existing
 * behaviour around partial games / abandoned-streak-resets stays intact.
 */
function applyCompletedGame(prev: Stats, entry: CompletedGame): Stats {
  const m = prev.byMode[entry.drawMode];
  const updatedMode = {
    played: m.played + 1,
    won: m.won + (entry.won ? 1 : 0),
    bestTimeMs: entry.won
      ? m.bestTimeMs === null || entry.durationMs < m.bestTimeMs
        ? entry.durationMs
        : m.bestTimeMs
      : m.bestTimeMs,
    bestScore: entry.won
      ? m.bestScore === null || entry.finalScore > m.bestScore
        ? entry.finalScore
        : m.bestScore
      : m.bestScore,
  };
  // Most-recent-last so chronological iteration is the natural order. The
  // capacity slice keeps the localStorage payload bounded.
  const history = [...prev.history, entry].slice(-STATS_HISTORY_MAX);
  return {
    ...prev,
    byMode: { ...prev.byMode, [entry.drawMode]: updatedMode },
    history,
    totalPlayTimeMs: prev.totalPlayTimeMs + entry.durationMs,
  };
}

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
  autoPausedByVisibility: false,

  newGame: (opts) => {
    // Capture the outgoing game BEFORE we overwrite state — starting a new
    // deal while the previous one was still in progress (playing or paused)
    // counts as abandoning it, which must break the win streak.
    const prevGame = get().game;
    const prevStatus = prevGame.status;
    const prevDealType = get().settings.dealType;
    const abandonedInProgress =
      prevStatus === "playing" || prevStatus === "paused";
    // We only count a game as "abandoned" if the player actually made a move.
    // A fresh deal where the user immediately hits "Neu" again wasn't really
    // played, so we don't pollute the history with zero-duration entries.
    const abandonedRecordable =
      abandonedInProgress && prevGame.moveCount > 0;

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

    const game = dealKlondike(seed, drawMode, nextSettings.redealLimit);
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
    const prevStats = get().stats;
    let stats: Stats = {
      ...prevStats,
      gamesPlayed: prevStats.gamesPlayed + 1,
      currentStreak: abandonedInProgress ? 0 : prevStats.currentStreak,
    };
    if (abandonedRecordable) {
      const now = Date.now();
      const duration = elapsedMs(prevGame, now);
      stats = applyCompletedGame(stats, {
        endedAt: now,
        drawMode: prevGame.drawMode,
        dealType: prevDealType,
        durationMs: duration,
        score: prevGame.score,
        finalScore: prevGame.score,
        moves: prevGame.moveCount,
        won: false,
      });
    }
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

  pause: () => {
    const result = pauseGame(get().game, Date.now());
    if (!result.ok) return;
    // A manual pause supersedes any auto-pause: once the user explicitly
    // pauses, returning to the tab should NOT auto-resume behind their back.
    set({ game: result.state, hint: null, autoPausedByVisibility: false });
    saveCurrentGame(result.state, get().history);
  },

  resume: () => {
    const result = resumeGame(get().game, Date.now());
    if (!result.ok) return;
    // Clear any auto-complete failure that accumulated from an attempt
    // during pause (where tryApplyMove would have rejected the move).
    set({
      game: result.state,
      autoCompleteFailed: false,
      autoPausedByVisibility: false,
    });
    saveCurrentGame(result.state, get().history);
  },

  togglePause: () => {
    const status = get().game.status;
    if (status === "playing") get().pause();
    else if (status === "paused") get().resume();
  },

  autoPause: () => {
    // Only pause if we haven't already auto-paused and the game is actively
    // running. A manually-paused or finished game must not be touched.
    if (get().autoPausedByVisibility) return;
    if (get().game.status !== "playing") return;
    const result = pauseGame(get().game, Date.now());
    if (!result.ok) return;
    set({
      game: result.state,
      hint: null,
      autoPausedByVisibility: true,
    });
    saveCurrentGame(result.state, get().history);
  },

  autoResume: () => {
    // Only un-pause games that WE auto-paused; never touch a manual pause.
    if (!get().autoPausedByVisibility) return;
    const result = resumeGame(get().game, Date.now());
    if (!result.ok) {
      // State drifted (e.g. newGame while hidden). Clear the flag so we don't
      // get stuck thinking we own a pause that no longer exists.
      set({ autoPausedByVisibility: false });
      return;
    }
    set({
      game: result.state,
      autoCompleteFailed: false,
      autoPausedByVisibility: false,
    });
    saveCurrentGame(result.state, get().history);
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
      // rather than a single instantaneous mutation. With prefers-reduced-
      // motion enabled we yield to the event loop instead — every step still
      // dispatches separately (so the canvas can repaint between them) but
      // the user sees the foundations fill near-instantly.
      const stepDelay = reducedMotion() ? 0 : 90;
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    saveCurrentGame(get().game, get().history);
    if (get().game.status === "won" || isWon(get().game)) {
      // Mark won if not already, and drain the running session into the
      // accumulator so _recordWin sees the full elapsed time. tryApplyMove
      // already does this on the winning move, but auto-complete may have
      // aborted (intent === null) right after isWon flipped without the
      // drain — defense in depth.
      const cur = get().game;
      if (cur.status !== "won") {
        const sessionMs =
          cur.startedAt !== null ? Math.max(0, Date.now() - cur.startedAt) : 0;
        set({
          game: {
            ...cur,
            status: "won",
            accumulatedMs: cur.accumulatedMs + sessionMs,
            startedAt: null,
          },
        });
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
    // Use freshStats() so resets don't share sub-object references with each
    // other (or with the module-level defaultStats), which would otherwise
    // make a future in-place mutation accidentally global.
    const cleared = freshStats();
    set({ stats: cleared });
    saveStats(cleared);
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
      const game = dealKlondike(undefined, settings.drawMode, settings.redealLimit);
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
    const now = Date.now();
    const total = elapsedMs(game, now);
    const final = finalScore(game.score, total);
    const prev = get().stats;
    let stats: Stats = {
      ...prev,
      gamesWon: prev.gamesWon + 1,
      bestTimeMs:
        prev.bestTimeMs === null || total < prev.bestTimeMs
          ? total
          : prev.bestTimeMs,
      bestScore:
        prev.bestScore === null || final > prev.bestScore ? final : prev.bestScore,
      currentStreak: prev.currentStreak + 1,
      longestStreak: Math.max(prev.longestStreak, prev.currentStreak + 1),
    };
    stats = applyCompletedGame(stats, {
      endedAt: now,
      drawMode: game.drawMode,
      dealType: get().settings.dealType,
      durationMs: total,
      score: game.score,
      finalScore: final,
      moves: game.moveCount,
      won: true,
    });
    // Trigger the canvas win finale. The CanvasBoard observer will short-
    // circuit it if prefers-reduced-motion is enabled.
    set({ stats, winFinalePlaying: true });
    saveStats(stats);
  },
}));

