import type { ThemeId } from "@/lib/game/types";

/* ------------------------------------------------------------------ */
/*  Palette interfaces                                                 */
/* ------------------------------------------------------------------ */

export interface CardPalette {
  cardBg: string;
  cardRing: string;
  red: string;
  black: string;
  backFrom: string;
  backTo: string;
  backInnerRing: string;
  backStripeA: string;
  backStripeB: string;
  faceBoxFrom: string;
  faceBoxTo: string;
  faceBoxRing: string;
  emptyBg: string;
  emptyDash: string;
  emptyHintStock: string;
  emptyHintFoundation: string;
  cardShadow: string;
}

/** RGB tuple for colors that need dynamic alpha (hint/hover rings). */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface BoardPalette {
  felt: string;
  hoverRing: RGB;
  hintRing: RGB;
  badgeBg: string;
  badgeText: string;
  hintGhostAlpha: number;
  dragGhostOpacity: number;
}

export interface FontConfig {
  primary: string;
  serif: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  card: CardPalette;
  board: BoardPalette;
  fonts: FontConfig;
}

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

export function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
}

/* ------------------------------------------------------------------ */
/*  Classic (current values from the codebase)                         */
/* ------------------------------------------------------------------ */

const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SERIF =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const MONO =
  'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace';

const CLASSIC: Theme = {
  id: "classic",
  label: "Klassisch",
  card: {
    cardBg: "#ffffff",
    cardRing: "rgba(0,0,0,0.15)",
    red: "#e11d48",
    black: "#18181b",
    backFrom: "#0369a1",
    backTo: "#0c4a6e",
    backInnerRing: "rgba(255,255,255,0.30)",
    backStripeA: "rgba(255,255,255,0.16)",
    backStripeB: "rgba(255,255,255,0.12)",
    faceBoxFrom: "#fafafa",
    faceBoxTo: "#e4e4e7",
    faceBoxRing: "rgba(0,0,0,0.10)",
    emptyBg: "rgba(255,255,255,0.04)",
    emptyDash: "rgba(255,255,255,0.18)",
    emptyHintStock: "rgba(255,255,255,0.50)",
    emptyHintFoundation: "rgba(255,255,255,0.30)",
    cardShadow: "rgba(0,0,0,0.18)",
  },
  board: {
    felt: "#064d27",
    hoverRing: { r: 110, g: 231, b: 183 },
    hintRing: { r: 252, g: 211, b: 77 },
    badgeBg: "rgba(0,0,0,0.7)",
    badgeText: "#fcd34d",
    hintGhostAlpha: 0.7,
    dragGhostOpacity: 0.3,
  },
  fonts: { primary: SANS, serif: SERIF },
};

/* ------------------------------------------------------------------ */
/*  Neon / Cyberpunk                                                   */
/* ------------------------------------------------------------------ */

const NEON: Theme = {
  id: "neon",
  label: "Neon",
  card: {
    cardBg: "#1a1a2e",
    cardRing: "rgba(0,240,255,0.15)",
    red: "#ff2d7b",
    black: "#00f0ff",
    backFrom: "#4a0e4e",
    backTo: "#1a0533",
    backInnerRing: "rgba(0,240,255,0.30)",
    backStripeA: "rgba(255,45,123,0.20)",
    backStripeB: "rgba(0,240,255,0.15)",
    faceBoxFrom: "#16163a",
    faceBoxTo: "#0e0e2a",
    faceBoxRing: "rgba(0,240,255,0.15)",
    emptyBg: "rgba(0,240,255,0.03)",
    emptyDash: "rgba(0,240,255,0.25)",
    emptyHintStock: "rgba(0,240,255,0.60)",
    emptyHintFoundation: "rgba(255,45,123,0.40)",
    cardShadow: "rgba(100,0,150,0.30)",
  },
  board: {
    felt: "#0a0a1a",
    hoverRing: { r: 0, g: 240, b: 255 },
    hintRing: { r: 255, g: 45, b: 123 },
    badgeBg: "rgba(0,0,0,0.8)",
    badgeText: "#00f0ff",
    hintGhostAlpha: 0.75,
    dragGhostOpacity: 0.35,
  },
  fonts: { primary: MONO, serif: MONO },
};

/* ------------------------------------------------------------------ */
/*  Vintage / Retro                                                    */
/* ------------------------------------------------------------------ */

const VINTAGE: Theme = {
  id: "vintage",
  label: "Vintage",
  card: {
    cardBg: "#f5eed6",
    cardRing: "rgba(60,40,20,0.20)",
    red: "#8b1a2b",
    black: "#2c1810",
    backFrom: "#1a5c3a",
    backTo: "#0d3b24",
    backInnerRing: "rgba(201,162,39,0.30)",
    backStripeA: "rgba(201,162,39,0.16)",
    backStripeB: "rgba(201,162,39,0.10)",
    faceBoxFrom: "#ede4cc",
    faceBoxTo: "#d4c5a0",
    faceBoxRing: "rgba(60,40,20,0.12)",
    emptyBg: "rgba(201,162,39,0.04)",
    emptyDash: "rgba(201,162,39,0.25)",
    emptyHintStock: "rgba(201,162,39,0.55)",
    emptyHintFoundation: "rgba(201,162,39,0.35)",
    cardShadow: "rgba(40,25,10,0.25)",
  },
  board: {
    felt: "#3d2b1f",
    hoverRing: { r: 201, g: 162, b: 39 },
    hintRing: { r: 201, g: 162, b: 39 },
    badgeBg: "rgba(30,18,8,0.75)",
    badgeText: "#c9a227",
    hintGhostAlpha: 0.7,
    dragGhostOpacity: 0.3,
  },
  fonts: { primary: SANS, serif: SERIF },
};

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export const THEMES: Record<ThemeId, Theme> = {
  classic: CLASSIC,
  neon: NEON,
  vintage: VINTAGE,
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: "Klassisch",
  neon: "Neon",
  vintage: "Vintage",
};
