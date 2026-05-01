"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import type { DealType, ThemeId } from "@/lib/game/types";
import { THEMES, type Theme } from "@/lib/theme/themes";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  random: "Zufällig",
  winnable: "Gewinnbar",
  replay: "Gleiche Mischung",
  daily: "Tagesrätsel",
};

const DEAL_TYPE_BLURBS: Record<Exclude<DealType, "replay">, string> = {
  random: "Frei gemischt",
  winnable: "Garantiert lösbar",
  daily: "Heute für alle",
};

/* ------------------------------------------------------------ */
/*  Visuelle Bausteine                                            */
/* ------------------------------------------------------------ */

/** Tiny SVG card preview rendered in the colours of a given theme. Covers
 *  both the front (with a one-glyph corner index) and the back. Pure SVG so
 *  it inherits scaling and is dead-cheap to render in a dropdown. */
function MiniCard({
  theme,
  variant,
  width = 30,
  height = 42,
}: {
  theme: Theme;
  variant: "back" | "red" | "black";
  width?: number;
  height?: number;
}) {
  const r = width * 0.14;
  if (variant === "back") {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`back-${theme.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.card.backFrom} />
            <stop offset="100%" stopColor={theme.card.backTo} />
          </linearGradient>
        </defs>
        <rect
          x="0.5"
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={r}
          fill={`url(#back-${theme.id})`}
          stroke={theme.card.backInnerRing}
          strokeWidth="0.6"
        />
      </svg>
    );
  }
  const fg = variant === "red" ? theme.card.red : theme.card.black;
  const glyph = variant === "red" ? "♥" : "♠";
  const rank = variant === "red" ? "A" : "K";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width={width - 1}
        height={height - 1}
        rx={r}
        fill={theme.card.cardBg}
        stroke={theme.card.cardRing}
        strokeWidth="0.6"
      />
      <text
        x={width * 0.18}
        y={height * 0.34}
        fill={fg}
        fontSize={width * 0.32}
        fontWeight="bold"
        fontFamily="ui-sans-serif, system-ui"
      >
        {rank}
      </text>
      <text
        x={width * 0.5}
        y={height * 0.78}
        fill={fg}
        fontSize={width * 0.55}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="ui-sans-serif, system-ui"
      >
        {glyph}
      </text>
    </svg>
  );
}

/** Full theme tile: a swatch of felt with three sample cards laid on top.
 *  Acts as the radio button in the theme group. */
function ThemeTile({
  themeId,
  active,
  onSelect,
}: {
  themeId: ThemeId;
  active: boolean;
  onSelect: () => void;
}) {
  const t = THEMES[themeId];
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      aria-label={`Thema ${t.label}`}
      className={[
        "group relative flex flex-col gap-1.5 p-1.5 rounded-lg ring-1 transition-colors",
        active
          ? "ring-2 ring-[var(--color-active)] bg-[var(--color-dropdown-hover)]"
          : "ring-[var(--color-dropdown-border)] hover:bg-[var(--color-dropdown-hover)]",
      ].join(" ")}
    >
      {/* Felt panel with three mini-cards: back + red + black so each theme's
         palette is visible at a glance. */}
      <div
        className="relative w-full overflow-hidden rounded-md flex items-end justify-center pb-1"
        style={{
          background: t.board.felt,
          height: 48,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-end gap-[3px] -mb-2">
          <span style={{ transform: "translateY(2px) rotate(-6deg)" }}>
            <MiniCard theme={t} variant="back" width={20} height={28} />
          </span>
          <span style={{ transform: "translateY(0) rotate(-2deg)" }}>
            <MiniCard theme={t} variant="black" width={22} height={31} />
          </span>
          <span style={{ transform: "translateY(2px) rotate(4deg)" }}>
            <MiniCard theme={t} variant="red" width={20} height={28} />
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-white">{t.label}</span>
        {active && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-active)]"
            aria-hidden="true"
          >
            <svg
              className="w-2.5 h-2.5 text-[var(--color-dropdown-bg)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}

/** Visual radio for the draw mode: one card vs. three cards fanned out, each
 *  rendered in the user's currently active theme so the preview matches. */
function DrawModeTile({
  cards,
  label,
  active,
  theme,
  onSelect,
}: {
  cards: 1 | 3;
  label: string;
  active: boolean;
  theme: Theme;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      aria-label={label}
      className={[
        "flex flex-col items-center gap-2 p-3 rounded-lg ring-1 transition-colors",
        active
          ? "ring-2 ring-[var(--color-active)] bg-[var(--color-dropdown-hover)]"
          : "ring-[var(--color-dropdown-border)] hover:bg-[var(--color-dropdown-hover)]",
      ].join(" ")}
    >
      <div className="relative h-[58px] w-[68px] flex items-end justify-center">
        {cards === 1 ? (
          <MiniCard theme={theme} variant="red" width={36} height={50} />
        ) : (
          <div className="relative">
            {/* Three cards fanned to the right (mirrors waste-fan layout in
               the real game). */}
            <span className="absolute left-0 top-0">
              <MiniCard theme={theme} variant="black" width={36} height={50} />
            </span>
            <span
              className="absolute top-0"
              style={{ left: 9 }}
            >
              <MiniCard theme={theme} variant="red" width={36} height={50} />
            </span>
            <span
              className="absolute top-0"
              style={{ left: 18 }}
            >
              <MiniCard theme={theme} variant="black" width={36} height={50} />
            </span>
            {/* Spacer so the absolute children have a parent height. */}
            <span
              className="block invisible"
              style={{ width: 54, height: 50 }}
            />
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-white">{label}</span>
    </button>
  );
}

/** Pill button used in the redeals row. Compact and easy to tap. */
function RedealPill({
  active,
  onSelect,
  short,
  long,
}: {
  active: boolean;
  onSelect: () => void;
  /** Big label inside the pill (e.g. "∞", "2", "0"). */
  short: string;
  /** Sub-label shown below — adds context without crowding the pill. */
  long: string;
}) {
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      aria-label={long}
      className={[
        "flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg ring-1 transition-colors",
        active
          ? "ring-2 ring-[var(--color-active)] bg-[var(--color-dropdown-hover)]"
          : "ring-[var(--color-dropdown-border)] hover:bg-[var(--color-dropdown-hover)]",
      ].join(" ")}
    >
      <span className="text-base font-semibold tabular-nums text-white">
        {short}
      </span>
      <span className="text-[10px] text-[var(--color-dropdown-subtext)] leading-tight">
        {long}
      </span>
    </button>
  );
}

/** Section heading used to separate the four groups inside the popover. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-dropdown-subtext)]">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ */
/*  Hauptkomponente                                                */
/* ------------------------------------------------------------ */

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
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
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

  const activeTheme = THEMES[themeId];

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
          aria-haspopup="menu"
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
          className="absolute left-0 top-full mt-1.5 z-50 w-[min(22rem,calc(100vw-1rem))] max-h-[min(80vh,40rem)] overflow-y-auto rounded-xl bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] shadow-2xl text-sm text-white"
          role="menu"
        >
          {/* ---------- Spielmodus ---------- */}
          <GroupLabel>Spielmodus</GroupLabel>
          <div className="px-3 grid grid-cols-3 gap-1.5">
            {(["random", "winnable", "daily"] as const).map((dt) => (
              <button
                key={dt}
                onClick={() => startGame(dt)}
                className={[
                  "flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg ring-1 transition-colors text-left",
                  dealType === dt
                    ? "ring-2 ring-[var(--color-active)] bg-[var(--color-dropdown-hover)]"
                    : "ring-[var(--color-dropdown-border)] hover:bg-[var(--color-dropdown-hover)]",
                ].join(" ")}
              >
                <span className="text-xs font-semibold leading-tight">
                  {DEAL_TYPE_LABELS[dt]}
                </span>
                <span className="text-[10px] text-[var(--color-dropdown-subtext)] leading-tight">
                  {DEAL_TYPE_BLURBS[dt]}
                </span>
              </button>
            ))}
          </div>
          <div className="px-3 pt-1.5 pb-2">
            <button
              onClick={() => startGame("replay")}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-10 rounded-lg ring-1 ring-[var(--color-dropdown-border)] hover:bg-[var(--color-dropdown-hover)] transition-colors text-xs font-medium"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {DEAL_TYPE_LABELS.replay}
            </button>
          </div>

          <div className="border-t border-[var(--color-dropdown-border)]" />

          {/* ---------- Karten ziehen ---------- */}
          <GroupLabel>Karten ziehen</GroupLabel>
          <div
            className="px-3 pb-2 grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Karten ziehen"
          >
            <DrawModeTile
              cards={1}
              label="1 Karte"
              active={drawMode === 1}
              theme={activeTheme}
              onSelect={() => startGame(dealType, 1)}
            />
            <DrawModeTile
              cards={3}
              label="3 Karten"
              active={drawMode === 3}
              theme={activeTheme}
              onSelect={() => startGame(dealType, 3)}
            />
          </div>

          <div className="border-t border-[var(--color-dropdown-border)]" />

          {/* ---------- Redeals ---------- */}
          <GroupLabel>Redeals</GroupLabel>
          <div
            className="px-3 pb-2 grid grid-cols-4 gap-1.5"
            role="radiogroup"
            aria-label="Erlaubte Redeals"
          >
            <RedealPill
              active={redealLimit === null}
              onSelect={() => {
                updateSettings({ redealLimit: null });
                setMenuOpen(false);
              }}
              short="∞"
              long="unbegrenzt"
            />
            <RedealPill
              active={redealLimit === 2}
              onSelect={() => {
                updateSettings({ redealLimit: 2 });
                setMenuOpen(false);
              }}
              short="2"
              long="klassisch"
            />
            <RedealPill
              active={redealLimit === 1}
              onSelect={() => {
                updateSettings({ redealLimit: 1 });
                setMenuOpen(false);
              }}
              short="1"
              long="ein Redeal"
            />
            <RedealPill
              active={redealLimit === 0}
              onSelect={() => {
                updateSettings({ redealLimit: 0 });
                setMenuOpen(false);
              }}
              short="0"
              long="Vegas"
            />
          </div>

          <div className="border-t border-[var(--color-dropdown-border)]" />

          {/* ---------- Thema ---------- */}
          <GroupLabel>Thema</GroupLabel>
          <div
            className="px-3 pb-3 grid grid-cols-3 gap-1.5"
            role="radiogroup"
            aria-label="Thema"
          >
            {(["classic", "neon", "vintage"] as const).map((t) => (
              <ThemeTile
                key={t}
                themeId={t}
                active={themeId === t}
                onSelect={() => {
                  updateSettings({ theme: t });
                  setMenuOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
