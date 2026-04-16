// Pointer-event state machine for the canvas board.
//
// Distinguishes between click and drag, applies a 120ms touch activation
// delay (matching the previous @dnd-kit TouchSensor config), and emits
// callbacks for the host to translate into store actions.

import { dropTest, hitTest } from "./hitTest";
import type { DragSource, DragState, HitTarget, Layout, Point } from "./types";
import type { Card, CardId, GameState, PileId } from "@/lib/game/types";

const DRAG_THRESHOLD_PX = 6;
const TOUCH_ACTIVATION_MS = 120;
// Max gap between two consecutive taps to count as a double-tap. The browser
// default is ~500ms but that feels sluggish for a game; 350ms keeps fast
// single-clicks responsive while still catching deliberate double-taps.
const DOUBLE_CLICK_MS = 350;

export interface InputCallbacks {
  /** Latest layout — re-queried on every event so resizes don't stale. */
  getLayout(): Layout | null;
  /** Latest game state from the store. */
  getGame(): GameState;
  /** Stock pile clicked: trigger draw or recycle. */
  onClickStock(): void;
  /** Face-up card clicked (no drag): auto-move to best destination. */
  onClickCard(source: DragSource, cardId: CardId): void;
  /**
   * Second click on the same pile within DOUBLE_CLICK_MS. The host should
   * force-send the pile's top card to its foundation (even if the single-click
   * would have picked a tableau target). Use to split a run or commit a
   * foundation move from anywhere in the stack.
   */
  onDoubleClickCard?(source: DragSource, cardId: CardId): void;
  /** Drag completed over a valid pile target: dispatch the move. */
  onDrop(source: DragSource, target: PileId, cardId: CardId): void;
  /** Drag state changed (started, moved, or ended). null = no drag. */
  onDragStateChange(state: DragState | null): void;
  /** Hover target during drag changed. null = none. */
  onHoverChange(pileId: PileId | null): void;
  /** True when an orchestrated animation is running and input should be
   * locked (e.g. auto-complete cascade). */
  isAnimating(): boolean;
}

type State =
  | { kind: "idle" }
  | {
      kind: "pressed";
      target: HitTarget;
      pt: Point;
      pointerId: number;
      startedAt: number;
      isTouch: boolean;
    }
  | {
      kind: "dragging";
      source: DragSource;
      cards: Card[];
      grabOffset: Point;
      pt: Point;
      pointerId: number;
    };

export function attachInput(
  canvas: HTMLCanvasElement,
  cb: InputCallbacks,
): () => void {
  let state: State = { kind: "idle" };
  let lastHoveredPile: PileId | null = null;
  // Tracks the most recent card-click so the next click can be classified
  // as a double-tap. Cleared after a drag, a stock click, or a successful
  // double-tap to prevent triple-tap compounding.
  let lastCardClick: { pileId: PileId; t: number } | null = null;

  const localPoint = (e: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (cb.isAnimating()) return;
    if (state.kind !== "idle") return;
    const layout = cb.getLayout();
    if (!layout) return;

    const pt = localPoint(e);
    const target = hitTest(layout, pt.x, pt.y);
    if (target.kind === "none") return;

    // Capture the pointer so we keep getting move events outside the canvas.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore — some browsers reject capture in synthetic tests
    }

    state = {
      kind: "pressed",
      target,
      pt,
      pointerId: e.pointerId,
      startedAt: e.timeStamp || performance.now(),
      isTouch: e.pointerType === "touch",
    };
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (state.kind === "idle") return;
    if (e.pointerId !== state.pointerId) return;
    const pt = localPoint(e);

    if (state.kind === "pressed") {
      // Touch activation delay: ignore moves until 120ms have passed.
      const elapsed = (e.timeStamp || performance.now()) - state.startedAt;
      if (state.isTouch && elapsed < TOUCH_ACTIVATION_MS) return;

      // Distance threshold to enter drag mode (cards only).
      const dx = pt.x - state.pt.x;
      const dy = pt.y - state.pt.y;
      const distance = Math.hypot(dx, dy);
      if (distance < DRAG_THRESHOLD_PX) return;

      // Stock clicks never become drags — they're click-only.
      if (state.target.kind !== "card") return;

      // Resolve the source card stack from the current store state.
      const game = cb.getGame();
      const layout = cb.getLayout();
      if (!layout) return;
      const source: DragSource = { pileId: state.target.pileId };
      const cards = resolveDragCards(game, source, state.target.cardId);
      if (cards.length === 0) {
        state = { kind: "idle" };
        return;
      }
      // Compute grab offset relative to the bottom card's top-left.
      const cardBox = layout.piles[source.pileId]?.cards[
        state.target.indexInPile
      ];
      const grabOffset: Point = cardBox
        ? { x: state.pt.x - cardBox.x, y: state.pt.y - cardBox.y }
        : { x: 0, y: 0 };

      const cardIds = new Set<CardId>();
      for (const c of cards) cardIds.add(c.id);

      const newState: State = {
        kind: "dragging",
        source: { ...source, cardIndex: state.target.indexInPile },
        cards,
        grabOffset,
        pt,
        pointerId: e.pointerId,
      };
      state = newState;
      cb.onDragStateChange({
        source: newState.source,
        cards: newState.cards,
        pt,
        grabOffset,
        cardIds,
      });
      return;
    }

    if (state.kind === "dragging") {
      state.pt = pt;
      const layout = cb.getLayout();
      const hovered = layout ? dropTest(layout, pt.x, pt.y) : null;
      if (hovered !== lastHoveredPile) {
        lastHoveredPile = hovered;
        cb.onHoverChange(hovered);
      }
      cb.onDragStateChange({
        source: state.source,
        cards: state.cards,
        pt,
        grabOffset: state.grabOffset,
        cardIds: new Set(state.cards.map((c) => c.id)),
      });
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (state.kind === "idle") return;
    if (e.pointerId !== state.pointerId) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (state.kind === "pressed") {
      // No drag occurred → treat as click.
      const target = state.target;
      const now = e.timeStamp || performance.now();
      state = { kind: "idle" };
      if (target.kind === "pile" && target.pileId === "stock") {
        lastCardClick = null;
        cb.onClickStock();
      } else if (target.kind === "card") {
        const isDouble =
          lastCardClick !== null &&
          lastCardClick.pileId === target.pileId &&
          now - lastCardClick.t < DOUBLE_CLICK_MS;
        if (isDouble && cb.onDoubleClickCard) {
          lastCardClick = null;
          cb.onDoubleClickCard({ pileId: target.pileId }, target.cardId);
        } else {
          lastCardClick = { pileId: target.pileId, t: now };
          cb.onClickCard({ pileId: target.pileId }, target.cardId);
        }
      }
      return;
    }

    if (state.kind === "dragging") {
      const pt = localPoint(e);
      const layout = cb.getLayout();
      const target = layout ? dropTest(layout, pt.x, pt.y) : null;
      const source = state.source;
      const droppedCard = state.cards[0];
      state = { kind: "idle" };
      lastHoveredPile = null;
      // A drag breaks any pending double-tap sequence.
      lastCardClick = null;
      cb.onHoverChange(null);
      cb.onDragStateChange(null);
      if (target && droppedCard) {
        cb.onDrop(source, target, droppedCard.id);
      }
    }
  };

  const onPointerCancel = (e: PointerEvent): void => {
    if (state.kind === "idle") return;
    if (e.pointerId !== state.pointerId) return;
    state = { kind: "idle" };
    lastHoveredPile = null;
    cb.onHoverChange(null);
    cb.onDragStateChange(null);
  };

  const onContextMenu = (e: Event): void => {
    // Block the right-click menu so long-press doesn't open it on touch.
    e.preventDefault();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("contextmenu", onContextMenu);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("contextmenu", onContextMenu);
  };
}

/**
 * Resolve the stack of cards being grabbed from a source pile + bottom card.
 */
function resolveDragCards(
  game: GameState,
  source: DragSource,
  cardId: CardId,
): Card[] {
  if (source.pileId.startsWith("tableau-")) {
    const idx = Number(source.pileId.slice("tableau-".length));
    const pile = game.tableau[idx];
    if (!pile) return [];
    const cardIdx = pile.cards.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) return [];
    // Only face-up runs are draggable.
    const run = pile.cards.slice(cardIdx);
    if (run.some((c) => !c.faceUp)) return [];
    return run.slice();
  }
  if (source.pileId === "waste") {
    const top = game.waste.cards[game.waste.cards.length - 1];
    return top && top.id === cardId ? [top] : [];
  }
  if (source.pileId.startsWith("foundation-")) {
    const idx = Number(source.pileId.slice("foundation-".length));
    const pile = game.foundations[idx];
    if (!pile) return [];
    const top = pile.cards[pile.cards.length - 1];
    return top && top.id === cardId ? [top] : [];
  }
  return [];
}
