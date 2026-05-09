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
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className="relative ml-1 sm:ml-2 inline-flex items-center justify-center min-h-10 min-w-10 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 px-2.5 sm:px-3.5 py-1.5 text-white ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_rgba(0,0,0,0.18)] transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <StatsIcon />
      {showBadge && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 text-[10px] font-bold leading-none text-white shadow-lg ring-2 ring-[var(--color-felt-dark)] tabular-nums"
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
