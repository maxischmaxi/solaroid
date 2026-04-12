// Scheduler: bridges store mutations into canvas tweens.
//
// Pattern: after every store change, compute the new layout, diff it against
// the previous one, and emit one tween per card that moved or flipped. The
// `hint` argument lets the caller request special pacing for orchestrated
// actions like draw, recycle, and the initial deal.

import type { Animator } from "./animator";
import { easeInOutQuad, easeOutCubic } from "./animator";
import { computeLayout } from "./layout";
import type { Layout, Tween } from "./types";
import type {
  CardId,
  DrawMode,
  GameState,
  PileId,
} from "@/lib/game/types";

export type SchedulerHint = "draw" | "recycle" | "deal" | undefined;

export interface SchedulerDeps {
  animator: Animator;
  getBoardSize(): { w: number; h: number };
}

export interface Scheduler {
  /** Compute the new layout, diff against the previous, and queue tweens. */
  reconcile(nextGame: GameState, hint?: SchedulerHint): void;
  /** Forget the previous layout. The next reconcile will not animate (used
   * after hydrating from localStorage so existing piles snap into place). */
  reset(): void;
  /** Force-set the previous layout (for tests / synthetic baselines). */
  setPrev(layout: Layout): void;
  /** Read the most recently committed layout. */
  getLayout(): Layout | null;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  let prev: Layout | null = null;
  let prevGame: GameState | null = null;

  function reconcile(nextGame: GameState, hint?: SchedulerHint): void {
    const { w, h } = deps.getBoardSize();
    const next = computeLayout(nextGame, w, h, nextGame.drawMode);

    // Auto-detect the hint from state-shape changes if the caller didn't
    // pass one. Lets the host call reconcile(state) without ceremony.
    if (hint === undefined && prevGame) {
      hint = detectHint(prevGame, nextGame);
    }

    // Deal cascade always animates regardless of prev — its tweens come from
    // the stock pile, not from the previous layout.
    if (hint === "deal") {
      emitDealCascade(deps.animator, next);
      prev = next;
      prevGame = nextGame;
      return;
    }

    // First reconcile after a reset → no animation, just snap.
    if (!prev) {
      prev = next;
      prevGame = nextGame;
      return;
    }

    const tweens = diffLayouts(prev, next);

    if (hint === "draw") {
      // Stagger the drawn cards 40ms apart in their flight order. The card
      // that ends up on top of the waste flies last (so it's the most recent
      // motion the eye tracks).
      const drawTweens = tweens.filter(
        (t) => t.from.face === "down" && t.to.face === "up",
      );
      drawTweens.forEach((t, i) => {
        t.delay = i * 40;
        t.duration = 200;
        t.easing = easeOutCubic;
        t.kind = "draw";
      });
      // Any other tweens (none expected, but be defensive) keep defaults.
      for (const t of tweens) deps.animator.add(t);
      prev = next;
      prevGame = nextGame;
      return;
    }

    if (hint === "recycle") {
      // All waste cards fly back to stock as face-down backs. We override
      // from.face to 'down' so the animator never shows the card identity
      // mid-flight — otherwise the staggered tweens hold the future
      // stock-top card face-up at its source position during pre-roll,
      // spoiling the next draw.
      tweens.forEach((t, i) => {
        t.delay = i * 12;
        t.duration = 240;
        t.easing = easeInOutQuad;
        t.kind = "recycle";
        t.from = { ...t.from, face: "down" };
      });
      for (const t of tweens) deps.animator.add(t);
      prev = next;
      prevGame = nextGame;
      return;
    }

    // Generic move (drag, click auto-move, undo, auto-complete step).
    for (const t of tweens) {
      t.duration = 220;
      t.easing = easeOutCubic;
      t.kind = "move";
      deps.animator.add(t);
    }
    prev = next;
    prevGame = nextGame;
  }

  function reset(): void {
    prev = null;
    prevGame = null;
  }

  function setPrev(layout: Layout): void {
    prev = layout;
  }

  function getLayout(): Layout | null {
    return prev;
  }

  return { reconcile, reset, setPrev, getLayout };
}

/* ---------- Hint detection ---------- */

/**
 * Infer a SchedulerHint from the shape change between two GameStates.
 *
 * - `deal`: the seed changed (newGame was called)
 * - `recycle`: stockCycles was incremented
 * - `draw`: stock shrunk and waste grew (Stock → Waste)
 * - undefined: a generic move (drag, click auto-move, undo, auto-complete)
 *
 * Undo deliberately returns undefined so the diff emits inverse tweens for
 * exactly the cards that moved on the original action — which is the
 * desired animation.
 */
export function detectHint(prev: GameState, next: GameState): SchedulerHint {
  if (next.seed !== prev.seed) {
    return "deal";
  }
  if (next.stockCycles > prev.stockCycles) {
    return "recycle";
  }
  if (
    prev.stock.cards.length > next.stock.cards.length &&
    next.waste.cards.length > prev.waste.cards.length
  ) {
    return "draw";
  }
  return undefined;
}

/* ---------- Diff core ---------- */

/** Diff two layouts by cardId and return one tween per moved/flipped card. */
export function diffLayouts(prev: Layout, next: Layout): Tween[] {
  const tweens: Tween[] = [];
  for (const cardId of Object.keys(next.cardIndex) as CardId[]) {
    const prevLoc = locate(prev, cardId);
    const nextLoc = locate(next, cardId);
    if (!prevLoc || !nextLoc) continue;
    const moved =
      prevLoc.x !== nextLoc.x ||
      prevLoc.y !== nextLoc.y ||
      prevLoc.faceUp !== nextLoc.faceUp;
    if (!moved) continue;
    tweens.push({
      id: cardId,
      cardId,
      kind: "move",
      from: {
        x: prevLoc.x,
        y: prevLoc.y,
        face: prevLoc.faceUp ? "up" : "down",
      },
      to: {
        x: nextLoc.x,
        y: nextLoc.y,
        face: nextLoc.faceUp ? "up" : "down",
      },
      duration: 220,
      easing: easeOutCubic,
    });
  }
  return tweens;
}

interface CardLoc {
  x: number;
  y: number;
  faceUp: boolean;
}

function locate(layout: Layout, cardId: CardId): CardLoc | null {
  const idx = layout.cardIndex[cardId];
  if (!idx) return null;
  const pile = layout.piles[idx.pileId];
  if (!pile) return null;
  const card = pile.cards[idx.indexInPile];
  if (!card) return null;
  return { x: card.x, y: card.y, faceUp: card.faceUp };
}

/* ---------- Deal cascade ---------- */

function emitDealCascade(animator: Animator, next: Layout): void {
  const stock = next.piles["stock"];
  // Use the stock card slot as every card's starting position.
  const startX = stock.x;
  const startY = stock.y;

  // Build a flight queue: for tableau cards, deal in the traditional row
  // order — round 1 across all 7 columns, round 2 across columns 1..6, etc.
  // The traditional Klondike deal order makes for a satisfying cascade.
  type DealItem = {
    cardId: CardId;
    toX: number;
    toY: number;
    toFace: "up" | "down";
  };
  const queue: DealItem[] = [];

  // Tableau columns 0..6: emit cards by stack-index then column-index.
  const maxStack = 7;
  for (let row = 0; row < maxStack; row++) {
    for (let col = row; col < 7; col++) {
      const pileId = `tableau-${col}` as PileId;
      const pile = next.piles[pileId];
      const card = pile?.cards[row];
      if (!card) continue;
      queue.push({
        cardId: card.cardId,
        toX: card.x,
        toY: card.y,
        toFace: card.faceUp ? "up" : "down",
      });
    }
  }

  // Stock cards stay in place — no tween needed for them.
  // Foundations & waste are empty after a fresh deal.

  queue.forEach((item, i) => {
    animator.add({
      id: item.cardId,
      cardId: item.cardId,
      kind: "deal",
      from: { x: startX, y: startY, face: "down" },
      to: { x: item.toX, y: item.toY, face: item.toFace },
      duration: 280,
      delay: i * 25,
      easing: easeOutCubic,
    });
  });
}

/* ---------- Helpers exposed for tests ---------- */

export function buildAllInStockLayout(game: GameState): Layout {
  // For deterministic tests of the deal cascade. Synthesizes a layout where
  // every card sits on the stock pile.
  const layout = computeLayout(game, 776, 600, game.drawMode);
  const stock = layout.piles["stock"];
  // Mutate a fresh copy
  const out: Layout = JSON.parse(JSON.stringify(layout));
  for (const cardId of Object.keys(out.cardIndex) as CardId[]) {
    out.cardIndex[cardId] = { pileId: "stock", indexInPile: 0 };
  }
  // Replace each pile's cards: stock gets all 52, others empty
  const allCards = Object.keys(out.cardIndex).map((id, i) => ({
    x: stock.x,
    y: stock.y,
    w: stock.w,
    h: stock.h,
    cardId: id as CardId,
    faceUp: false,
    z: i,
  }));
  out.piles["stock"] = { ...stock, cards: allCards };
  for (const pid of Object.keys(out.piles)) {
    if (pid !== "stock") {
      out.piles[pid as keyof typeof out.piles] = {
        ...out.piles[pid as keyof typeof out.piles],
        cards: [],
      };
    }
  }
  return out;
}

export type { DrawMode };
