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

function FlameIcon() {
  return (
    <svg
      className="h-2.5 w-2.5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 1c.4 3.5-2 5.4-3.5 7.6-1.5 2.2-3 4.4-3 7.4 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2.6-5.6-4.4-8C16.8 5.6 15.6 3.6 13.5 1Zm-.6 14.5c.6-.7 1-1.5 1.1-2.2.7 1 1.6 1.7 1.6 3.2A2.5 2.5 0 1 1 11.6 18c0-.5.4-1.4 1.3-2.5Z" />
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
      className="ui-control ui-control-secondary relative ml-1 h-9 min-w-9 px-3 py-0 sm:ml-2"
    >
      <StatsIcon />
      {showBadge && (
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center gap-px rounded-full bg-gradient-to-b from-brass-bright to-brass px-1 text-[10px] font-bold leading-none text-pine shadow-lg ring-2 ring-felt-dark tabular-nums"
          aria-hidden="true"
        >
          {/* Flame + count is more iconic than just a number; keep it terse so
             the badge stays compact on mobile. */}
          <FlameIcon />
          {currentStreak}
        </span>
      )}
    </button>
  );
}
