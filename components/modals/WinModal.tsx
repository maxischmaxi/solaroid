"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/lib/store/gameStore";
import { finalScore, timeBonus } from "@/lib/game/scoring";
import { elapsedMs } from "@/lib/game/time";
import { Modal } from "./Modal";
import { NewGameButton } from "@/components/game/NewGameButton";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatTime(ms: number): string {
  const sec = Math.max(1, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ScoreTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ui-stat-tile p-3 text-left">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-modal-subtext)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
}

export function WinModal({ open, onClose }: Props) {
  const game = useGameStore((s) => s.game);

  useEffect(() => {
    if (!open) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    confetti({
      particleCount: 200,
      spread: 80,
      origin: { y: 0.6 },
    });
    const t = setTimeout(() => {
      confetti({ particleCount: 120, spread: 120, origin: { y: 0.5 } });
    }, 400);
    return () => clearTimeout(t);
  }, [open]);

  // After tryApplyMove drains the running session on win, `accumulatedMs`
  // holds the full play time and `startedAt` is null. Use a pure read here;
  // Date.now() during render would make React's purity lint unhappy.
  const elapsed = Math.max(1000, elapsedMs(game, 0));
  const bonus = timeBonus(elapsed);
  const totalScore = finalScore(game.score, elapsed);

  return (
    <Modal open={open} onClose={onClose} title="Gewonnen!">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 text-4xl ring-1 ring-amber-500/25">
          🎉
        </div>
        <h3 className="text-xl font-semibold tracking-tight">
          Sauber abgeschlossen
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-modal-subtext)]">
          Alle Karten liegen auf den Foundations. Hier ist dein Ergebnis für
          diese Runde.
        </p>

        <div className="ui-stat-tile ui-stat-tile-accent mt-5 w-full p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-modal-subtext)]">
            Endscore
          </div>
          <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            {totalScore.toLocaleString("de-DE")}
          </div>
        </div>

        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <ScoreTile label="Zeit" value={formatTime(elapsed)} />
          <ScoreTile label="Züge" value={game.moveCount} />
          <ScoreTile label="Basis" value={game.score} />
          <ScoreTile label="Zeitbonus" value={`+${bonus}`} />
        </div>

        <div className="mt-6 flex w-full flex-col gap-2">
          <NewGameButton
            label="Neues Spiel"
            fullWidth
            onAfterStart={onClose}
          />
          <button
            type="button"
            onClick={onClose}
            className="ui-control ui-control-modal-secondary ui-control-full h-10"
          >
            Brett ansehen
          </button>
        </div>
      </div>
    </Modal>
  );
}
