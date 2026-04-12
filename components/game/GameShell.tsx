"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { CanvasBoard } from "./CanvasBoard";
import { Header } from "./Header";
import { GameOverModal } from "@/components/modals/GameOverModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { StatsModal } from "@/components/modals/StatsModal";
import { WinModal } from "@/components/modals/WinModal";

export function GameShell() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const gameStatus = useGameStore((s) => s.game.status);
  const autoCompleteEnabled = useGameStore(
    (s) => s.settings.autoCompleteEnabled,
  );
  const canAutoComplete = useGameStore((s) => s.canAutoComplete());
  const autoComplete = useGameStore((s) => s.autoComplete);
  const autoCompleteRunning = useGameStore((s) => s.autoCompleteRunning);
  const winFinalePlaying = useGameStore((s) => s.winFinalePlaying);
  const gameOverOpen = useGameStore((s) => s.gameOverOpen);
  const closeGameOver = useGameStore((s) => s.closeGameOver);

  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);

  // Initial hydration from localStorage on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Open the win modal once the canvas has finished its win-finale cascade.
  // While the cascade is still running we let the player enjoy the cards
  // bouncing across the felt before the score panel covers them.
  useEffect(() => {
    if (gameStatus === "won" && !winFinalePlaying) {
      setWinOpen(true);
    }
  }, [gameStatus, winFinalePlaying]);

  // Auto-trigger auto-complete when eligible (and the user has it enabled).
  useEffect(() => {
    if (canAutoComplete && autoCompleteEnabled && !autoCompleteRunning) {
      autoComplete();
    }
  }, [canAutoComplete, autoCompleteEnabled, autoCompleteRunning, autoComplete]);

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
      <Header
        onOpenStats={() => setStatsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {hydrated ? (
        <CanvasBoard />
      ) : (
        <div className="flex-1 bg-[var(--color-felt-dark)]" />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <WinModal open={winOpen} onClose={() => setWinOpen(false)} />
      <GameOverModal open={gameOverOpen} onClose={closeGameOver} />
    </div>
  );
}
