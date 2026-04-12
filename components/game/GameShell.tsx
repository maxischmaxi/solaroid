"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { THEMES } from "@/lib/theme/themes";
import { CanvasBoard } from "./CanvasBoard";
import { Header } from "./Header";
import { GameOverModal } from "@/components/modals/GameOverModal";
import { StatsModal } from "@/components/modals/StatsModal";
import { WinModal } from "@/components/modals/WinModal";

export function GameShell() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const gameStatus = useGameStore((s) => s.game.status);
  const canAutoComplete = useGameStore((s) => s.canAutoComplete());
  const autoComplete = useGameStore((s) => s.autoComplete);
  const autoCompleteRunning = useGameStore((s) => s.autoCompleteRunning);
  const winFinalePlaying = useGameStore((s) => s.winFinalePlaying);
  const gameOverOpen = useGameStore((s) => s.gameOverOpen);
  const closeGameOver = useGameStore((s) => s.closeGameOver);

  const themeId = useGameStore((s) => s.settings.theme);

  const [statsOpen, setStatsOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);

  // Initial hydration from localStorage on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  // Auto-trigger auto-complete when eligible — always on.
  useEffect(() => {
    if (canAutoComplete && !autoCompleteRunning) {
      autoComplete();
    }
  }, [canAutoComplete, autoCompleteRunning, autoComplete]);

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
        <CanvasBoard />
      ) : (
        <div className="flex-1 bg-[var(--color-felt-dark)]" />
      )}

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <WinModal open={winOpen} onClose={() => setWinOpen(false)} />
      <GameOverModal open={gameOverOpen} onClose={closeGameOver} />
    </div>
  );
}
