"use client";

import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";

interface Props {
  onClick: () => void;
}

function StatsIcon() {
  return (
    <svg
      className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </svg>
  );
}

/**
 * Stats opener with a small streak badge in the top-right corner. Reading
 * `currentStreak` and `gamesPlayed` lets us:
 *   - hide the badge until there's a streak worth bragging about (≥ 2)
 *   - swap the title attribute to surface the win-rate without opening the modal
 */
export function StatsButton({ onClick }: Props) {
  const { currentStreak, gamesPlayed, gamesWon } = useGameStore(
    useShallow((s) => ({
      currentStreak: s.stats.currentStreak,
      gamesPlayed: s.stats.gamesPlayed,
      gamesWon: s.stats.gamesWon,
    })),
  );

  const winRate =
    gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : null;
  const showBadge = currentStreak >= 2;
  const title =
    winRate !== null
      ? `Statistik · Quote ${winRate}%${currentStreak > 0 ? ` · Serie ${currentStreak}` : ""}`
      : "Statistik";

  return (
    <button
      onClick={onClick}
      aria-label={title}
      title={title}
      className="relative ml-1 sm:ml-2 inline-flex items-center justify-center min-h-10 min-w-10 px-2.5 sm:px-3 py-1.5 rounded bg-[var(--color-btn-secondary)] hover:bg-[var(--color-btn-secondary-hover)] active:bg-[var(--color-btn-secondary-active)] shadow text-white"
    >
      <StatsIcon />
      {showBadge && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold leading-none bg-orange-500 text-white shadow ring-2 ring-[var(--color-felt-dark)] tabular-nums"
          aria-hidden="true"
        >
          {/* Flame + count is more iconic than just a number; keep it terse so
             the badge stays compact on mobile. */}
          🔥{currentStreak}
        </span>
      )}
    </button>
  );
}
