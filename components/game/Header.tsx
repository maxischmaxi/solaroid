"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import { NewGameButton } from "./NewGameButton";
import { StatsButton } from "./StatsButton";

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface HeaderProps {
  onOpenStats: () => void;
}

interface IconBtnProps {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  variant?: "secondary" | "hint" | "auto";
  pulse?: boolean;
  showLabelOnSm?: boolean;
  children: React.ReactNode;
}

function IconBtn({
  onClick,
  disabled,
  label,
  shortcut,
  variant = "secondary",
  pulse,
  showLabelOnSm = true,
  children,
}: IconBtnProps) {
  const palette = {
    secondary: "bg-white/10 hover:bg-white/20 active:bg-white/25 ring-white/15",
    hint: "bg-amber-400/20 hover:bg-amber-400/30 active:bg-amber-400/35 ring-amber-200/25 text-amber-50",
    auto: "bg-emerald-400/20 hover:bg-emerald-400/30 active:bg-emerald-400/35 ring-emerald-200/25 text-emerald-50",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      className={[
        "relative inline-flex items-center justify-center gap-1.5 overflow-hidden",
        // Touch-target floor: 40px tall, 40px wide on icon-only mobile state.
        "min-h-10 min-w-10 px-2.5 sm:px-3.5 py-1.5",
        "rounded-xl font-semibold text-white ring-1",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_rgba(0,0,0,0.18)]",
        "transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0",
        palette,
        pulse ? "animate-pulse" : "",
      ].join(" ")}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
      {showLabelOnSm && (
        <span className="hidden sm:inline text-sm">{label}</span>
      )}
    </button>
  );
}

const ICON_CLASS = "w-4 h-4 sm:w-[18px] sm:h-[18px]";

function UndoIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7" />
    </svg>
  );
}

function HintIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.8 1 1.5 1 2.5v1h6v-1c0-1 .3-1.7 1-2.5A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M7 5.5v13a1 1 0 0 0 1.55.83l9.5-6.5a1 1 0 0 0 0-1.66l-9.5-6.5A1 1 0 0 0 7 5.5Z" />
    </svg>
  );
}

function AutoIcon() {
  // Fast-forward (▶▶) — semantically "play to the end", which is what
  // auto-complete actually does. Two triangles read clearly at 16-18px even
  // when the button is pulsing.
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <polygon points="3,5 13,12 3,19" />
      <polygon points="12,5 22,12 12,19" />
    </svg>
  );
}

export function Header({ onOpenStats }: HeaderProps) {
  const {
    score,
    moves,
    startedAt,
    accumulatedMs,
    status,
    canUndo,
    canAutoComplete,
  } = useGameStore(
    useShallow((s) => ({
      score: s.game.score,
      moves: s.game.moveCount,
      startedAt: s.game.startedAt,
      accumulatedMs: s.game.accumulatedMs,
      status: s.game.status,
      canUndo: s.history.length > 0,
      canAutoComplete: s.canAutoComplete(),
    })),
  );

  const undo = useGameStore((s) => s.undo);
  const autoComplete = useGameStore((s) => s.autoComplete);
  const requestHint = useGameStore((s) => s.requestHint);
  const togglePause = useGameStore((s) => s.togglePause);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, status]);

  const elapsed =
    status === "playing" && startedAt !== null
      ? accumulatedMs + Math.max(0, now - startedAt)
      : accumulatedMs;
  const isPaused = status === "paused";

  return (
    <header
      className="relative z-50 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-white"
      style={{ minHeight: 56 }}
    >
      <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 min-w-0 rounded-2xl bg-black/15 ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md p-1">
        <NewGameButton />
        <IconBtn
          onClick={undo}
          disabled={!canUndo}
          label="Undo"
          shortcut="U"
        >
          <UndoIcon />
        </IconBtn>
        <IconBtn
          onClick={requestHint}
          label="Tipp"
          shortcut="H"
          variant="hint"
        >
          <HintIcon />
        </IconBtn>
        <IconBtn
          onClick={togglePause}
          disabled={status !== "playing" && status !== "paused"}
          label={isPaused ? "Weiter" : "Pause"}
          shortcut="P"
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </IconBtn>
        {canAutoComplete && (
          <IconBtn
            onClick={() => autoComplete()}
            label="Auto"
            variant="auto"
            pulse
          >
            <AutoIcon />
          </IconBtn>
        )}
      </div>

      {/* Spacer so the stats can flex-right while staying compact on phones. */}
      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3 tabular-nums text-xs sm:text-sm">
        <div className="flex items-baseline gap-1">
          <span className="opacity-60">⏱</span>
          <span className="font-semibold">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="opacity-60">★</span>
          <span className="font-semibold">{score}</span>
        </div>
        <div className="hidden sm:flex items-baseline gap-1">
          <span className="opacity-60">Züge</span>
          <span className="font-semibold">{moves}</span>
        </div>
      </div>

      <StatsButton onClick={onOpenStats} />
    </header>
  );
}
