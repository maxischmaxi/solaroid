"use client";

interface SparklineProps {
  /** Series in chronological order. Last point gets the highlight dot. */
  data: number[];
  width?: number;
  height?: number;
  /** Optional minimum visible y-axis value (e.g. 0 for non-negative scores). */
  yMin?: number;
  /** Shown when the series is empty or has only one entry. */
  emptyLabel?: string;
}

function buildLinearPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

export function Sparkline({
  data,
  width = 320,
  height = 72,
  yMin,
  emptyLabel = "Noch zu wenig Daten",
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs italic text-[var(--color-modal-subtext)] rounded border border-dashed border-[var(--color-modal-border)]"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const padX = 6;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  const lowerBound = yMin ?? dataMin;
  // If every value is identical, expand the range by 1 so the line lands in
  // the middle instead of collapsing onto the bottom edge.
  const range = Math.max(1, dataMax - lowerBound);
  const points = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + (1 - (v - lowerBound) / range) * innerH,
  }));

  const lineD = buildLinearPath(points);
  const last = points[points.length - 1];
  const fillD = `${lineD} L${(padX + innerW).toFixed(2)},${height} L${padX.toFixed(2)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full block text-[var(--color-btn-primary)]"
      style={{ height }}
      role="img"
      aria-label="Score-Verlauf der letzten Spiele"
    >
      {/* Soft fill under the curve. fill-opacity instead of an SVG <linearGradient>
         so the colour stays in sync with whatever currentColor we inherit. */}
      <path d={fillD} fill="currentColor" fillOpacity={0.14} />
      <path
        d={lineD}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={3.5} fill="currentColor" />
      <circle
        cx={last.x}
        cy={last.y}
        r={6}
        fill="currentColor"
        fillOpacity={0.25}
      />
    </svg>
  );
}
