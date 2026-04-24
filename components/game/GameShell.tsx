"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import { THEMES } from "@/lib/theme/themes";
import { CanvasBoard } from "./CanvasBoard";
import { Header } from "./Header";
import { GameOverModal } from "@/components/modals/GameOverModal";
import { StatsModal } from "@/components/modals/StatsModal";
import { WinModal } from "@/components/modals/WinModal";

export function GameShell() {
  // Single subscription for the shell's scalar dependencies.
  const {
    hydrated,
    gameStatus,
    canAutoComplete,
    autoCompleteRunning,
    winFinalePlaying,
    gameOverOpen,
    themeId,
    autoPausedByVisibility,
  } = useGameStore(
    useShallow((s) => ({
      hydrated: s.hydrated,
      gameStatus: s.game.status,
      canAutoComplete: s.canAutoComplete(),
      autoCompleteRunning: s.autoCompleteRunning,
      winFinalePlaying: s.winFinalePlaying,
      gameOverOpen: s.gameOverOpen,
      themeId: s.settings.theme,
      autoPausedByVisibility: s.autoPausedByVisibility,
    })),
  );
  const isPaused = gameStatus === "paused";
  // Hide the Pause overlay while we're merely auto-paused for tab visibility —
  // the user didn't choose to pause, so showing a full-board takeover on return
  // would be jarring. Manual pauses still show the overlay normally.
  const showPauseOverlay = isPaused && !autoPausedByVisibility;
  // Actions are stable references; individual selectors are cheap.
  const hydrate = useGameStore((s) => s.hydrate);
  const autoComplete = useGameStore((s) => s.autoComplete);
  const closeGameOver = useGameStore((s) => s.closeGameOver);

  const [statsOpen, setStatsOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);

  // Global keyboard shortcuts. Registered on window so they work regardless
  // of which element the user last clicked (the canvas isn't focusable).
  useEffect(() => {
    if (!hydrated) return;

    function handleKey(e: KeyboardEvent) {
      // Respect text entry anywhere on the page.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (t?.isContentEditable) return;

      // Modals own their own keyboard flow (ESC close in Modal.tsx).
      if (statsOpen || winOpen || gameOverOpen) return;

      const state = useGameStore.getState();
      // Block while the auto-complete cascade is animating; commits are serialized.
      if (state.autoCompleteRunning) return;

      const key = e.key.toLowerCase();

      // Undo: Cmd/Ctrl+Z (classic) — allow while other modifiers can pass.
      if ((e.metaKey || e.ctrlKey) && key === "z" && !e.shiftKey && !e.altKey) {
        if (!state.canUndo()) return;
        e.preventDefault();
        state.undo();
        return;
      }

      // Plain-letter shortcuts: ignore if any modifier is held to avoid
      // hijacking browser chords (Ctrl+H history, Cmd+D bookmark, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (key) {
        case "u":
          if (!state.canUndo()) return;
          e.preventDefault();
          state.undo();
          return;
        case "h":
        case "?":
          e.preventDefault();
          state.requestHint();
          return;
        case " ":
        case "d": {
          // "Tap the stock" behaviour: draw if possible, otherwise recycle
          // the waste. Mirrors what the canvas input does on click.
          e.preventDefault();
          const g = state.game;
          if (g.stock.cards.length > 0) {
            state.drawFromStock();
          } else if (g.waste.cards.length > 0) {
            state.recycleWaste();
          }
          return;
        }
        case "escape":
          if (state.hint) {
            e.preventDefault();
            state.clearHint();
          }
          return;
        case "p":
          e.preventDefault();
          state.togglePause();
          return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hydrated, statsOpen, winOpen, gameOverOpen]);

  // Initial hydration from localStorage on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Pause the timer whenever the tab becomes hidden or the window loses focus,
  // resume when it's both visible and focused again. Uses the dedicated
  // autoPause/autoResume actions so manual pauses are never overridden.
  useEffect(() => {
    if (!hydrated) return;

    const isActive = (): boolean =>
      document.visibilityState === "visible" && document.hasFocus();

    const sync = (): void => {
      const store = useGameStore.getState();
      if (isActive()) {
        store.autoResume();
      } else {
        store.autoPause();
      }
    };

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    // Run once in case we mounted while the tab was already backgrounded.
    sync();

    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
    };
  }, [hydrated]);

  // Sync data-theme attribute on <html> and update meta theme-color.
  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEMES[themeId].board.felt);
    }
  }, [themeId]);

  // Open the win modal once the canvas has finished its win-finale cascade.
  // While the cascade is still running we let the player enjoy the cards
  // bouncing across the felt before the score panel covers them.
  useEffect(() => {
    if (gameStatus === "won" && !winFinalePlaying) {
      setWinOpen(true);
    }
  }, [gameStatus, winFinalePlaying]);

  // Auto-trigger auto-complete when eligible — always on, except while
  // paused (moves would be rejected, which would trip the failure flag).
  useEffect(() => {
    if (canAutoComplete && !autoCompleteRunning && !isPaused) {
      autoComplete();
    }
  }, [canAutoComplete, autoCompleteRunning, autoComplete, isPaused]);

  return (
    <div
      className="flex flex-col flex-1 min-h-dvh"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Header onOpenStats={() => setStatsOpen(true)} />
      {hydrated ? (
        <div className="relative flex-1 flex flex-col">
          <CanvasBoard />
          {showPauseOverlay && (
            <button
              type="button"
              aria-label="Spiel fortsetzen"
              onClick={() => useGameStore.getState().resume()}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-sm text-white cursor-pointer"
            >
              <div className="text-4xl font-semibold tracking-wide">
                Pause
              </div>
              <div className="text-sm opacity-80">
                Klicken oder <kbd className="font-mono">P</kbd> zum
                Fortsetzen
              </div>
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 bg-[var(--color-felt-dark)]" />
      )}

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <WinModal open={winOpen} onClose={() => setWinOpen(false)} />
      <GameOverModal open={gameOverOpen} onClose={closeGameOver} />
    </div>
  );
}
