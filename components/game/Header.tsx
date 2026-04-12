"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { NewGameButton } from "./NewGameButton";

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface HeaderProps {
  onOpenStats: () => void;
}

export function Header({ onOpenStats }: HeaderProps) {
  const score = useGameStore((s) => s.game.score);
  const moves = useGameStore((s) => s.game.moveCount);
  const startedAt = useGameStore((s) => s.game.startedAt);
  const status = useGameStore((s) => s.game.status);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const canAutoComplete = useGameStore((s) => s.canAutoComplete());
  const undo = useGameStore((s) => s.undo);
  const autoComplete = useGameStore((s) => s.autoComplete);
  const requestHint = useGameStore((s) => s.requestHint);
  const drawMode = useGameStore((s) => s.settings.drawMode);

  // Local timer tick — does NOT write to the store, only re-renders this component.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, status]);

  const elapsed = startedAt ? now - startedAt : 0;

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2 text-white text-sm">
      <div className="flex items-center gap-3">
        <NewGameButton />
        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded bg-[var(--color-btn-secondary)] hover:bg-[var(--color-btn-secondary-hover)] active:bg-[var(--color-btn-secondary-active)] disabled:opacity-50 px-3 py-1.5 font-medium shadow"
        >
          Undo
        </button>
        <button
          onClick={requestHint}
          className="rounded bg-[var(--color-btn-hint)] hover:bg-[var(--color-btn-hint-hover)] active:bg-[var(--color-btn-hint-active)] px-3 py-1.5 font-medium shadow"
        >
          Tipp
        </button>
        {canAutoComplete && (
          <button
            onClick={() => autoComplete()}
            className="rounded bg-[var(--color-btn-hint)] hover:bg-[var(--color-btn-hint-hover)] px-3 py-1.5 font-medium shadow animate-pulse"
          >
            Auto-Complete
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 tabular-nums">
        <div>
          <span className="opacity-70 mr-1">Zeit</span>
          <span className="font-semibold">{formatTime(elapsed)}</span>
        </div>
        <div>
          <span className="opacity-70 mr-1">Punkte</span>
          <span className="font-semibold">{score}</span>
        </div>
        <div className="hidden sm:block">
          <span className="opacity-70 mr-1">Züge</span>
          <span className="font-semibold">{moves}</span>
        </div>
        <div className="hidden md:block opacity-70">Draw {drawMode}</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenStats}
          className="rounded bg-[var(--color-btn-secondary)] hover:bg-[var(--color-btn-secondary-hover)] px-3 py-1.5 shadow"
          aria-label="Statistik"
        >
          📊
        </button>
      </div>
    </header>
  );
}
