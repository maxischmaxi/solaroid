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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Gespielt</dt>
        <dd className="text-right font-semibold">{stats.gamesPlayed}</dd>
        <dt className="text-zinc-500">Gewonnen</dt>
        <dd className="text-right font-semibold">{stats.gamesWon}</dd>
        <dt className="text-zinc-500">Quote</dt>
        <dd className="text-right font-semibold">{winRate}%</dd>
        <dt className="text-zinc-500">Beste Zeit</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatTime(stats.bestTimeMs)}
        </dd>
        <dt className="text-zinc-500">Bester Score</dt>
        <dd className="text-right font-semibold">
          {stats.bestScore ?? "—"}
        </dd>
        <dt className="text-zinc-500">Aktuelle Serie</dt>
        <dd className="text-right font-semibold">{stats.currentStreak}</dd>
        <dt className="text-zinc-500">Längste Serie</dt>
        <dd className="text-right font-semibold">{stats.longestStreak}</dd>
      </dl>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => {
            if (confirm("Statistik wirklich zurücksetzen?")) {
              reset();
            }
          }}
          className="text-xs text-rose-600 hover:underline"
        >
          Statistik zurücksetzen
        </button>
      </div>
    </Modal>
  );
}
