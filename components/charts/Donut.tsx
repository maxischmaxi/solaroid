"use client";

interface DonutProps {
  /** Numerator (e.g. games won). */
  value: number;
  /** Denominator (e.g. games played). When 0, an empty ring is shown. */
  total: number;
  size?: number;
  /** Stroke thickness in pixels. */
  thickness?: number;
  /** Big label in the centre (defaults to the percentage). */
  centerLabel?: string;
  /** Smaller secondary label below the main one. */
  centerSubLabel?: string;
}

export function Donut({
  value,
  total,
  size = 120,
  thickness = 12,
  centerLabel,
  centerSubLabel,
}: DonutProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const dash = circumference * ratio;
  const gap = circumference - dash;
  const percent = total > 0 ? Math.round(ratio * 100) : 0;
  const label = centerLabel ?? (total > 0 ? `${percent}%` : "—");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="text-[var(--color-btn-primary)]"
      role="img"
      aria-label={`${value} von ${total} (${percent} Prozent)`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={thickness}
      />
      {/* Filled arc — start at 12 o'clock by rotating -90°. */}
      {total > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y={centerSubLabel ? "44%" : "50%"}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[var(--color-modal-text)] font-semibold"
        style={{ fontSize: size * 0.22 }}
      >
        {label}
      </text>
      {centerSubLabel && (
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-[var(--color-modal-subtext)]"
          style={{ fontSize: size * 0.1 }}
        >
          {centerSubLabel}
        </text>
      )}
    </svg>
  );
}
