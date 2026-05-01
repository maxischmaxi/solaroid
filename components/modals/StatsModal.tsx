"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/lib/store/gameStore";
import type { CompletedGame, Stats } from "@/lib/persistence/storage";
import { Sparkline } from "@/components/charts/Sparkline";
import { Donut } from "@/components/charts/Donut";
import { BarRow } from "@/components/charts/BarRow";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Hero KPI tile — small label, big value, accent-coloured background. */
function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-0.5 p-3 rounded-lg ring-1",
        accent
          ? "bg-[var(--color-btn-primary)]/10 ring-[var(--color-btn-primary)]/20"
          : "bg-[var(--color-modal-border)]/40 ring-[var(--color-modal-border)]",
      ].join(" ")}
    >
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-modal-subtext)]">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums leading-tight">
        {value}
      </span>
      {hint && (
        <span className="text-[10px] text-[var(--color-modal-subtext)]">
          {hint}
        </span>
      )}
    </div>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 1c.4 3.5-2 5.4-3.5 7.6-1.5 2.2-3 4.4-3 7.4 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2.6-5.6-4.4-8C16.8 5.6 15.6 3.6 13.5 1Zm-.6 14.5c.6-.7 1-1.5 1.1-2.2.7 1 1.6 1.7 1.6 3.2A2.5 2.5 0 1 1 11.6 18c0-.5.4-1.4 1.3-2.5Z" />
    </svg>
  );
}

function StreakBanner({ stats }: { stats: Stats }) {
  if (stats.currentStreak <= 0) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-modal-border)]/40 ring-1 ring-[var(--color-modal-border)]">
        <div className="text-[var(--color-modal-subtext)]">
          <FlameIcon className="w-6 h-6 opacity-50" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Keine aktive Serie</div>
          <div className="text-xs text-[var(--color-modal-subtext)]">
            Längste Serie: {stats.longestStreak}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-500/15 via-amber-400/10 to-transparent ring-1 ring-orange-500/30">
      <FlameIcon className="w-7 h-7 text-orange-500 drop-shadow-sm" />
      <div className="flex-1">
        <div className="text-sm font-semibold">
          {stats.currentStreak} Sieg{stats.currentStreak === 1 ? "" : "e"} in
          Folge
        </div>
        <div className="text-xs text-[var(--color-modal-subtext)]">
          Persönlicher Rekord: {stats.longestStreak}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-modal-subtext)] font-semibold">
      {children}
    </h3>
  );
}

/** A small chip that highlights the latest game's outcome — useful when the
 *  Sparkline alone might be ambiguous (a low score isn't always a loss). */
function LatestGamePill({ game }: { game: CompletedGame | undefined }) {
  if (!game) return null;
  const won = game.won;
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
        won
          ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30"
          : "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25",
      ].join(" ")}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${won ? "bg-emerald-500" : "bg-rose-500"}`}
      />
      {won ? "Sieg" : "Verloren"} · Draw {game.drawMode} ·{" "}
      {formatTime(game.durationMs)}
    </div>
  );
}

export function StatsModal({ open, onClose }: Props) {
  const stats = useGameStore(useShallow((s) => s.stats));
  const reset = useGameStore((s) => s.resetStats);

  const [confirmReset, setConfirmReset] = useState(false);

  // Memoize the chart inputs so changing other store fields (timer ticks, etc.)
  // doesn't force the SVG to re-tween.
  const scoreSeries = useMemo(
    () => stats.history.slice(-30).map((g) => g.finalScore),
    [stats.history],
  );
  const lastGame = stats.history[stats.history.length - 1];

  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  // For the mode comparison, normalize each bar against whichever drawMode
  // has the higher win-rate so the visual ratio is read at a glance. The
  // numeric label still shows the raw percentage.
  const wr1 =
    stats.byMode[1].played > 0
      ? stats.byMode[1].won / stats.byMode[1].played
      : 0;
  const wr3 =
    stats.byMode[3].played > 0
      ? stats.byMode[3].won / stats.byMode[3].played
      : 0;
  const peak = Math.max(0.0001, wr1, wr3);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statistik"
      maxWidthClass="max-w-md"
    >
      {confirmReset ? (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm">Statistik wirklich zurücksetzen?</p>
          <p className="text-xs text-[var(--color-modal-subtext)]">
            Alle Siege, Bestwerte und der Verlauf gehen verloren. Diese Aktion
            kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConfirmReset(false)}
              className="flex-1 min-h-11 rounded bg-[var(--color-btn-modal-secondary-bg)] hover:bg-[var(--color-btn-modal-secondary-hover)] text-[var(--color-btn-modal-secondary-text)] font-medium"
            >
              Abbrechen
            </button>
            <button
              onClick={() => {
                reset();
                setConfirmReset(false);
              }}
              className="flex-1 min-h-11 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ----- Hero: win-rate donut + KPIs ----- */}
          <div className="flex items-center gap-4">
            <Donut
              value={stats.gamesWon}
              total={stats.gamesPlayed}
              size={110}
              thickness={11}
              centerLabel={`${winRate}%`}
              centerSubLabel="Quote"
            />
            <div className="grid grid-cols-1 gap-2 flex-1 min-w-0">
              <StatTile
                label="Beste Zeit"
                value={formatTime(stats.bestTimeMs)}
                hint={stats.bestTimeMs ? "Höchste Bestleistung" : "—"}
                accent
              />
              <StatTile
                label="Bester Score"
                value={
                  stats.bestScore !== null
                    ? stats.bestScore.toLocaleString("de-DE")
                    : "—"
                }
                hint="inkl. Zeitbonus"
                accent
              />
            </div>
          </div>

          {/* ----- Streak banner ----- */}
          <StreakBanner stats={stats} />

          {/* ----- Score sparkline ----- */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Score-Verlauf</SectionHeading>
              <LatestGamePill game={lastGame} />
            </div>
            <Sparkline
              data={scoreSeries}
              width={400}
              height={70}
              yMin={0}
              emptyLabel="Spiele beenden, um den Verlauf zu sehen"
            />
            {scoreSeries.length > 0 && (
              <div className="text-[10px] text-[var(--color-modal-subtext)] text-center">
                Letzte{" "}
                {scoreSeries.length === 1
                  ? "Partie"
                  : `${scoreSeries.length} Partien`}{" "}
                · älter ← → neuer
              </div>
            )}
          </div>

          {/* ----- Mode comparison ----- */}
          <div className="flex flex-col gap-3">
            <SectionHeading>Modi-Vergleich</SectionHeading>
            <BarRow
              label="Draw 1"
              value={stats.byMode[1].won}
              total={stats.byMode[1].played}
              ratio={wr1 / peak}
            />
            <BarRow
              label="Draw 3"
              value={stats.byMode[3].won}
              total={stats.byMode[3].played}
              ratio={wr3 / peak}
            />
          </div>

          {/* ----- Bottom aggregate row ----- */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Gespielt"
              value={String(stats.gamesPlayed)}
            />
            <StatTile
              label="Gewonnen"
              value={String(stats.gamesWon)}
            />
            <StatTile
              label="Spielzeit"
              value={formatDuration(stats.totalPlayTimeMs)}
            />
          </div>

          <div className="flex justify-end pt-1 border-t border-[var(--color-modal-border)]">
            <button
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center justify-center min-h-10 px-3 py-2 mt-3 text-xs rounded text-rose-600 hover:bg-rose-600/10 active:bg-rose-600/20 font-medium"
            >
              Statistik zurücksetzen
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
