"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/lib/store/gameStore";
import { Modal } from "./Modal";
import { NewGameButton } from "@/components/game/NewGameButton";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  const elapsed = game.startedAt ? Date.now() - game.startedAt : 0;

  return (
    <Modal open={open} onClose={onClose} title="Gewonnen!">
      <div className="space-y-3 text-center">
        <p className="text-3xl">🎉</p>
        <p className="text-[var(--color-modal-subtext)]">
          Bravo, du hast das Spiel gemeistert.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-4">
          <dt className="text-[var(--color-modal-subtext)] text-right">Zeit</dt>
          <dd className="text-left font-semibold tabular-nums">
            {formatTime(elapsed)}
          </dd>
          <dt className="text-[var(--color-modal-subtext)] text-right">Score</dt>
          <dd className="text-left font-semibold">{game.score}</dd>
          <dt className="text-[var(--color-modal-subtext)] text-right">Züge</dt>
          <dd className="text-left font-semibold">{game.moveCount}</dd>
        </dl>
        <div className="mt-4">
          <NewGameButton
            label="Neues Spiel"
            fullWidth
            onAfterStart={onClose}
          />
        </div>
      </div>
    </Modal>
  );
}
