"use client";

interface BarRowProps {
  label: string;
  /** Numerator. */
  value: number;
  /** Denominator. */
  total: number;
  /** Optional right-side detail string ("12/15"); auto-generated if omitted. */
  detail?: string;
  /** Optional ratio used to render the bar's filled portion. Defaults to
   *  value/total, but callers can pass a normalized "compared to peer" ratio
   *  for visualisation while still showing the raw value/total numbers. */
  ratio?: number;
}

/**
 * Single horizontal bar with a label, percentage fill, and a "value / total"
 * detail. Used for the Draw 1 vs Draw 3 comparison and similar two-row breakdowns.
 */
export function BarRow({ label, value, total, detail, ratio }: BarRowProps) {
  const r =
    typeof ratio === "number"
      ? Math.max(0, Math.min(1, ratio))
      : total > 0
        ? value / total
        : 0;
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const detailStr = detail ?? `${value}/${total}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-[var(--color-modal-subtext)] tabular-nums">
          {total > 0 ? `${percent}% · ${detailStr}` : "—"}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--color-modal-border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-btn-primary)]"
          style={{
            width: `${(r * 100).toFixed(1)}%`,
            transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}
