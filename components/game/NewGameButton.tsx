"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import type { DealType, ThemeId } from "@/lib/game/types";
import { THEME_LABELS, THEMES } from "@/lib/theme/themes";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  random: "Zufällige Mischung",
  winnable: "Gewinnbare Mischung",
  replay: "Gleiche Mischung",
  daily: "Tägliche Herausforderung",
};

function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const t = THEMES[themeId];
  return (
    <span className="inline-flex gap-0.5">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: t.board.felt }}
      />
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: t.card.red }}
      />
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: t.card.black }}
      />
    </span>
  );
}

interface Props {
  label?: string;
  onAfterStart?: () => void;
  fullWidth?: boolean;
}

export function NewGameButton({
  label = "Neu",
  onAfterStart,
  fullWidth,
}: Props) {
  // Consolidated settings read; the dropdown re-renders only when one of
  // these four fields changes, not on every game-state update.
  const { drawMode, dealType, themeId, redealLimit } = useGameStore(
    useShallow((s) => ({
      drawMode: s.settings.drawMode,
      dealType: s.settings.dealType,
      themeId: s.settings.theme,
      redealLimit: s.settings.redealLimit,
    })),
  );
  const newGame = useGameStore((s) => s.newGame);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [menuOpen]);

  function startGame(dt: DealType, dm?: 1 | 3) {
    if (dm !== undefined) {
      updateSettings({ drawMode: dm });
      newGame({ drawMode: dm, dealType: dt });
    } else {
      newGame({ dealType: dt });
    }
    setMenuOpen(false);
    onAfterStart?.();
  }

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`} ref={menuRef}>
      <div className={`flex ${fullWidth ? "w-full" : ""}`}>
        <button
          onClick={() => {
            newGame();
            onAfterStart?.();
          }}
          className={`inline-flex items-center justify-center min-h-10 rounded-l bg-[var(--color-btn-primary)] hover:bg-[var(--color-btn-primary-hover)] active:bg-[var(--color-btn-primary-active)] px-3 py-1.5 text-sm font-medium shadow text-white ${fullWidth ? "flex-1 text-center" : ""}`}
        >
          {label}
        </button>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center justify-center min-h-10 rounded-r bg-[var(--color-btn-primary)] hover:bg-[var(--color-btn-primary-hover)] active:bg-[var(--color-btn-primary-active)] px-2 py-1.5 shadow border-l border-[var(--color-btn-primary-border)] text-white"
          aria-label="Spieloptionen"
          aria-expanded={menuOpen}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-[min(16rem,calc(100vw-1rem))] max-h-[min(70vh,32rem)] overflow-y-auto rounded-lg bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] shadow-xl text-sm text-white"
          role="menu"
        >
          <div className="py-1">
            {(["random", "winnable", "daily"] as const).map((dt) => (
              <button
                key={dt}
                onClick={() => startGame(dt)}
                className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors flex items-center justify-between"
              >
                <span>{DEAL_TYPE_LABELS[dt]}</span>
                {dealType === dt && (
                  <span className="text-[var(--color-active)] text-xs font-bold">
                    aktiv
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => startGame("replay")}
              className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors"
            >
              {DEAL_TYPE_LABELS.replay}
            </button>
          </div>

          <div className="border-t border-[var(--color-dropdown-border)] py-1">
            <div className="px-4 py-1.5 text-[var(--color-dropdown-subtext)] text-xs font-medium uppercase tracking-wider">
              Karten ziehen
            </div>
            <button
              onClick={() => startGame(dealType, 1)}
              className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors flex items-center justify-between"
            >
              <span>1 Karte</span>
              {drawMode === 1 && (
                <span className="text-[var(--color-active)] text-xs font-bold">
                  aktiv
                </span>
              )}
            </button>
            <button
              onClick={() => startGame(dealType, 3)}
              className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors flex items-center justify-between"
            >
              <span>3 Karten</span>
              {drawMode === 3 && (
                <span className="text-[var(--color-active)] text-xs font-bold">
                  aktiv
                </span>
              )}
            </button>
          </div>

          <div className="border-t border-[var(--color-dropdown-border)] py-1">
            <div className="px-4 py-1.5 text-[var(--color-dropdown-subtext)] text-xs font-medium uppercase tracking-wider">
              Redeals
            </div>
            {(
              [
                { value: null, label: "Unbegrenzt" },
                { value: 2, label: "2 (klassisch)" },
                { value: 1, label: "1" },
                { value: 0, label: "Kein Redeal (Vegas)" },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => {
                  updateSettings({ redealLimit: opt.value });
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors flex items-center justify-between"
              >
                <span>{opt.label}</span>
                {redealLimit === opt.value && (
                  <span className="text-[var(--color-active)] text-xs font-bold">
                    aktiv
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-dropdown-border)] py-1">
            <div className="px-4 py-1.5 text-[var(--color-dropdown-subtext)] text-xs font-medium uppercase tracking-wider">
              Thema
            </div>
            {(["classic", "neon", "vintage"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  updateSettings({ theme: t });
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-[var(--color-dropdown-hover)] transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <ThemeSwatch themeId={t} />
                  {THEME_LABELS[t]}
                </span>
                {themeId === t && (
                  <span className="text-[var(--color-active)] text-xs font-bold">
                    aktiv
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
