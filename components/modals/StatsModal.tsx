"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StatsModal({ open, onClose }: Props) {
  const stats = useGameStore((s) => s.stats);
  const reset = useGameStore((s) => s.resetStats);

  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  return (
    <Modal open={open} onClose={onClose} title="Statistik">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <dt className="text-[var(--color-modal-subtext)]">Gespielt</dt>
        <dd className="text-right font-semibold">{stats.gamesPlayed}</dd>
        <dt className="text-[var(--color-modal-subtext)]">Gewonnen</dt>
        <dd className="text-right font-semibold">{stats.gamesWon}</dd>
        <dt className="text-[var(--color-modal-subtext)]">Quote</dt>
        <dd className="text-right font-semibold">{winRate}%</dd>
        <dt className="text-[var(--color-modal-subtext)]">Beste Zeit</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatTime(stats.bestTimeMs)}
        </dd>
        <dt className="text-[var(--color-modal-subtext)]">Bester Score</dt>
        <dd className="text-right font-semibold">
          {stats.bestScore ?? "—"}
        </dd>
        <dt className="text-[var(--color-modal-subtext)]">Aktuelle Serie</dt>
        <dd className="text-right font-semibold">{stats.currentStreak}</dd>
        <dt className="text-[var(--color-modal-subtext)]">Längste Serie</dt>
        <dd className="text-right font-semibold">{stats.longestStreak}</dd>
      </dl>
      <div className="mt-5 flex justify-end">
        <button
          onClick={() => {
            if (confirm("Statistik wirklich zurücksetzen?")) {
              reset();
            }
          }}
          className="inline-flex items-center justify-center min-h-10 px-3 py-2 text-sm rounded text-rose-600 hover:bg-rose-600/10 active:bg-rose-600/20 font-medium"
        >
          Statistik zurücksetzen
        </button>
      </div>
    </Modal>
  );
}
