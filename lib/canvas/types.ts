// Pure data types for the canvas rendering layer.
// No DOM, no canvas API references — these types are computed by the layout
// module and consumed by the renderer, hit tester, animator, etc.

import type {
  Card,
  CardId,
  DrawMode,
  GameState,
  PileId,
  PileKind,
} from "@/lib/game/types";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Position of a single card within a Layout. */
export interface CardBox extends Rect {
  cardId: CardId;
  faceUp: boolean;
  /** Stacking order within the pile, 0 = bottom. */
  z: number;
}

/** Position of a pile (origin) plus its laid-out cards and a drop hit-area. */
export interface PileBox extends Rect {
  pileId: PileId;
  kind: PileKind;
  cards: CardBox[];
  /**
   * Extended hit area used for drop testing (for tableau columns this covers
   * the full fanned column, not just the top card slot).
   */
  dropRect: Rect;
}

export interface Layout {
  boardW: number;
  boardH: number;
  cardW: number;
  cardH: number;
  pileGap: number;
  fanDown: number;
  piles: Record<PileId, PileBox>;
  cardIndex: Record<CardId, { pileId: PileId; indexInPile: number }>;
}

export type HitTarget =
  | { kind: "card"; pileId: PileId; cardId: CardId; indexInPile: number }
  | { kind: "pile"; pileId: PileId }
  | { kind: "none" };

/* ---------- Animation types ---------- */

export type Easing = (t: number) => number;

export type TweenKind = "move" | "deal" | "draw" | "recycle" | "snapback";

export interface TweenEndpoint {
  x: number;
  y: number;
  face: "up" | "down";
}

export interface Tween {
  /** Dedupe key. Defaults to cardId — starting a new tween for the same id
   * cancels the in-flight one. */
  id: string;
  cardId: CardId;
  kind: TweenKind;
  from: TweenEndpoint;
  to: TweenEndpoint;
  /** Duration in milliseconds (after `delay`). */
  duration: number;
  /** Optional pre-roll delay in milliseconds. */
  delay?: number;
  easing: Easing;
  /** Set by Animator on first tick after `delay` elapses. */
  startedAt?: number;
  onComplete?: () => void;
}

/** Snapshot of the animator's state for a single frame. */
export interface AnimSnapshot {
  /** Tweens that are currently in their active phase (post-delay). */
  active: Array<{
    tween: Tween;
    /** Linear progress 0..1 (post-easing — i.e., what the renderer should use). */
    eased: number;
    /** Interpolated position. */
    x: number;
    y: number;
    /** Current visual face. For flips this changes mid-tween. */
    face: "up" | "down";
    /** Horizontal scale 0..1 used for flip animations (1 outside flips). */
    scaleX: number;
  }>;
  /** Card IDs that are being drawn by the animator and should be skipped by
   * the static pile painter to avoid double-rendering. */
  suppressIds: Set<CardId>;
}

/* ---------- Drag types ---------- */

export interface DragSource {
  pileId: PileId;
  /** Index of the grabbed card within its source pile (only set for tableau). */
  cardIndex?: number;
}

export interface DragState {
  source: DragSource;
  cards: Card[]; // grabbed run, bottom-to-top
  pt: Point; // current pointer (canvas-local coords)
  grabOffset: Point; // pointerdown offset within the bottom card
  cardIds: Set<CardId>; // for renderer suppression
}

/* ---------- Scene (input to renderScene) ---------- */

export interface SpriteCacheLike {
  cardW: number;
  cardH: number;
  dpr: number;
}

/** Particle layer driven by the WinFinale module — empty in normal play. */
export interface WinFinaleScene {
  particles: ReadonlyArray<{
    cardId: CardId;
    x: number;
    y: number;
  }>;
  /** Cards that have been launched and should NOT be drawn in their foundation slot. */
  launchedIds: ReadonlySet<CardId>;
}

/** Active hint overlay — pulsing rings and an optional ghost card. */
export type HintScene =
  | {
      kind: "move";
      cardId: CardId;
      /** Source rect (where the hinted card currently sits). */
      from: Rect;
      /** Destination rect (where the next card slot is on the target pile). */
      to: Rect;
      /** Interpolated ghost-card position for the current frame. */
      ghostX: number;
      ghostY: number;
      /** Pulse alpha 0..1 for both rings. */
      pulse: number;
    }
  | {
      kind: "stock";
      action: "draw" | "recycle";
      target: Rect;
      pulse: number;
      /** How many times the player must click the stock pile. */
      draws: number;
    };

export interface Scene<S extends SpriteCacheLike> {
  layout: Layout;
  sprites: S;
  anims: AnimSnapshot;
  drag: DragState | null;
  hoveredPile: PileId | null;
  reducedMotion: boolean;
  /** Optional win-finale particle layer. */
  winFinale?: WinFinaleScene;
  /** Optional Tipp-button hint overlay. */
  hint?: HintScene;
}

/* ---------- Re-exports for convenience ---------- */

export type { Card, CardId, DrawMode, GameState, PileId, PileKind };
