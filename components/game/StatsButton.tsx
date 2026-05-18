"use client";

import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";

interface Props {
  onClick: () => void;
}

function StatsIcon() {
  return (
    <svg
      className="h-4 w-4 sm:h-5 sm:w-5"
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
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className="ui-control ui-control-secondary relative ml-1 h-9 min-w-9 rounded-md px-3 py-0 text-white sm:ml-2"
    >
      <StatsIcon />
      {showBadge && (
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-1 text-[10px] font-bold leading-none text-white shadow-lg ring-2 ring-[var(--color-felt-dark)] tabular-nums"
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
