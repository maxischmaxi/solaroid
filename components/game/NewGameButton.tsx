"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import type { DealType } from "@/lib/game/types";
import { CARD } from "@/lib/canvas/palette";

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

/** Tiny SVG card preview in the app's card colours. Covers the front (with a
 *  one-glyph corner index) and the back with its sun medallion. Pure SVG so
 *  it inherits scaling and is dead-cheap to render in a dropdown. */
function MiniCard({
  variant,
  width = 30,
  height = 42,
}: {
  variant: "back" | "red" | "black";
  width?: number;
  height?: number;
}) {
  const r = width * 0.14;
  if (variant === "back") {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mini-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CARD.backFrom} />
            <stop offset="100%" stopColor={CARD.backTo} />
          </linearGradient>
        </defs>
        <rect
          x="0.5"
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={r}
          fill="url(#mini-back)"
          stroke={CARD.backFrame}
          strokeWidth="0.6"
        />
        {/* Sun medallion, reduced to rays + disc at preview size. */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const inner = width * 0.18;
          const outer = width * 0.3;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cy + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * outer}
              y2={cy + Math.sin(a) * outer}
              stroke={CARD.sun}
              strokeWidth={width * 0.05}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={width * 0.13} fill={CARD.sun} />
      </svg>
    );
  }
  const fg = variant === "red" ? CARD.red : CARD.black;
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
        fill={CARD.cardBg}
        stroke={CARD.cardRing}
        strokeWidth="0.6"
      />
      <text
        x={width * 0.18}
        y={height * 0.34}
        fill={fg}
        fontSize={width * 0.32}
        fontWeight="bold"
        fontFamily="var(--font-ui), ui-sans-serif, system-ui"
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
        fontFamily="var(--font-ui), ui-sans-serif, system-ui"
      >
        {glyph}
      </text>
    </svg>
  );
}

/** Visual radio for the draw mode: one card vs. three cards fanned out. */
function DrawModeTile({
  cards,
  label,
  active,
  onSelect,
}: {
  cards: 1 | 3;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      aria-label={label}
      className="ui-choice flex flex-col items-center gap-2 rounded-lg p-3"
    >
      <div className="relative flex h-14 w-17 items-end justify-center">
        {cards === 1 ? (
          <MiniCard variant="red" width={36} height={50} />
        ) : (
          <div className="relative">
            {/* Three cards fanned to the right (mirrors waste-fan layout in
               the real game). */}
            <span className="absolute left-0 top-0">
              <MiniCard variant="black" width={36} height={50} />
            </span>
            <span className="absolute top-0" style={{ left: 9 }}>
              <MiniCard variant="red" width={36} height={50} />
            </span>
            <span className="absolute top-0" style={{ left: 18 }}>
              <MiniCard variant="black" width={36} height={50} />
            </span>
            {/* Spacer so the absolute children have a parent height. */}
            <span
              className="block invisible"
              style={{ width: 54, height: 50 }}
            />
          </div>
        )}
      </div>
      <span className="text-xs font-medium">{label}</span>
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
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      aria-label={long}
      className="ui-choice flex flex-col items-center gap-0.5 rounded-lg px-2 py-2"
    >
      <span className="text-base font-semibold tabular-nums">{short}</span>
      <span className="text-[10px] text-[var(--color-dropdown-subtext)] leading-tight">
        {long}
      </span>
    </button>
  );
}

/** Section heading used to separate the groups inside the popover. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="ui-section-label">{children}</div>;
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
  const { drawMode, dealType, redealLimit } = useGameStore(
    useShallow((s) => ({
      drawMode: s.settings.drawMode,
      dealType: s.settings.dealType,
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

  const primaryButtonClass = "ui-control ui-control-primary h-9 py-0 text-sm";

  return (
    <div className={`relative z-20 ${fullWidth ? "w-full" : ""}`} ref={menuRef}>
      <div className={`flex ${fullWidth ? "w-full" : ""}`}>
        <button
          type="button"
          onClick={() => {
            newGame();
            onAfterStart?.();
          }}
          className={`${primaryButtonClass} ui-control-split-left px-3.5 ${fullWidth ? "flex-1 text-center" : ""}`}
        >
          {label}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`${primaryButtonClass} ui-control-split-right`}
          aria-label="Spieloptionen"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
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
          className="ui-menu-panel absolute left-0 top-full z-50 mt-2 max-h-[min(80vh,40rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto p-1 text-sm text-[var(--color-dropdown-text)]"
          role="menu"
        >
          {/* ---------- Spielmodus ---------- */}
          <GroupLabel>Spielmodus</GroupLabel>
          <div className="grid grid-cols-3 gap-1.5 px-2">
            {(["random", "winnable", "daily"] as const).map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => startGame(dt)}
                role="menuitemradio"
                aria-checked={dealType === dt}
                className="ui-choice flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left"
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
          <div className="px-2 pb-2 pt-1.5">
            <button
              type="button"
              onClick={() => startGame("replay")}
              className="ui-choice inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
            >
              <svg
                className="h-4 w-4"
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
            className="grid grid-cols-2 gap-2 px-2 pb-2"
            role="radiogroup"
            aria-label="Karten ziehen"
          >
            <DrawModeTile
              cards={1}
              label="1 Karte"
              active={drawMode === 1}
              onSelect={() => startGame(dealType, 1)}
            />
            <DrawModeTile
              cards={3}
              label="3 Karten"
              active={drawMode === 3}
              onSelect={() => startGame(dealType, 3)}
            />
          </div>

          <div className="border-t border-[var(--color-dropdown-border)]" />

          {/* ---------- Redeals ---------- */}
          <GroupLabel>Redeals</GroupLabel>
          <div
            className="grid grid-cols-4 gap-1.5 px-2 pb-2"
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
        </div>
      )}
    </div>
  );
}
