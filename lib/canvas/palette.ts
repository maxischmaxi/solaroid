// The single visual identity of the board: every canvas-side color and font
// lives here. CSS owns the identical tokens for DOM chrome (globals.css);
// keep the two in sync when tuning.
//
// Design "Abendpartie": a night-time card table under a warm lamp — deep fir
// felt, ivory cards, carmine/charcoal indices, and a midnight-blue card back
// carrying the brass sun medallion (Solaroid → Sol).

/** RGB tuple for colors that need dynamic alpha (hint/hover rings). */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
}

/* ------------------------------------------------------------------ */
/*  Card palette                                                       */
/* ------------------------------------------------------------------ */

export const CARD = {
  /** Ivory card stock — warm, never sterile white. */
  cardBg: "#faf6ea",
  cardRing: "rgba(52, 42, 26, 0.24)",
  red: "#b52237",
  black: "#262a30",
  /** Midnight-blue back gradient. */
  backFrom: "#24487c",
  backTo: "#15294d",
  backFrame: "rgba(250, 246, 234, 0.34)",
  backFrameInner: "rgba(250, 246, 234, 0.16)",
  /** Brass sun medallion. */
  sun: "#e4bc62",
  sunCore: "#f2d894",
  sunRing: "rgba(228, 188, 98, 0.42)",
  /** Warm gradient box behind J/Q/K letters. */
  faceBoxFrom: "#f6f0dd",
  faceBoxTo: "#eadfc0",
  faceBoxRing: "rgba(52, 42, 26, 0.14)",
  /** Empty slots read as recesses pressed into the felt. */
  emptyBg: "rgba(0, 10, 5, 0.18)",
  emptyRing: "rgba(250, 246, 234, 0.16)",
  emptyGlyph: "rgba(250, 246, 234, 0.42)",
  emptyGlyphSoft: "rgba(250, 246, 234, 0.26)",
  cardShadow: "rgba(6, 18, 11, 0.38)",
} as const;

/* ------------------------------------------------------------------ */
/*  Board palette                                                      */
/* ------------------------------------------------------------------ */

export const BOARD = {
  /** Drop-target hover ring: warm ivory, neutral and calm. */
  hoverRing: { r: 250, g: 246, b: 234 } as RGB,
  /** Hint ring: brass, matches the sun medallion. */
  hintRing: { r: 228, g: 188, b: 98 } as RGB,
  badgeBg: "rgba(5, 22, 14, 0.82)",
  badgeText: "#ecc878",
  hintGhostAlpha: 0.7,
  dragGhostOpacity: 0.3,
} as const;

/* ------------------------------------------------------------------ */
/*  Fonts                                                              */
/* ------------------------------------------------------------------ */

const SANS_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SERIF_FALLBACK =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

let uiFamily = SANS_FALLBACK;
let displayFamily = SERIF_FALLBACK;

/**
 * Pull the next/font-generated family stacks out of the CSS variables set on
 * <html> (see app/layout.tsx). Safe to call before the DOM exists — the
 * fallback stacks stay in place until it succeeds. Sprites built before the
 * webfonts finish loading are rebuilt by CanvasBoard via document.fonts.
 */
export function refreshCanvasFonts(): void {
  if (typeof window === "undefined") return;
  const styles = getComputedStyle(document.documentElement);
  const ui = styles.getPropertyValue("--font-ui").trim();
  const display = styles.getPropertyValue("--font-display").trim();
  if (ui) uiFamily = `${ui}, ${SANS_FALLBACK}`;
  if (display) displayFamily = `${display}, ${SERIF_FALLBACK}`;
}

/** UI grotesk — corner indices, badges, empty-slot glyphs. */
export function uiFont(): string {
  return uiFamily;
}

/** Display serif — court-card letters (J/Q/K), foundation "A". */
export function displayFont(): string {
  return displayFamily;
}
