import { flipTopIfNeeded } from "./flip";
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  topCardOf,
} from "./rules";
import { flipReveal, moveScoreDelta } from "./scoring";
import { drawFromStock, recycleWaste } from "./stock";
import type {
  ApplyResult,
  CardId,
  GameState,
  MoveIntent,
  Pile,
  PileId,
} from "./types";
import { isWon } from "./win";

function getPile(state: GameState, id: PileId): Pile | null {
  if (id === "stock") return state.stock;
  if (id === "waste") return state.waste;
  if (id.startsWith("tableau-")) {
    const idx = Number(id.slice("tableau-".length));
    return state.tableau[idx] ?? null;
  }
  if (id.startsWith("foundation-")) {
    const idx = Number(id.slice("foundation-".length));
    return state.foundations[idx] ?? null;
  }
  return null;
}

function withPile(state: GameState, pile: Pile): GameState {
  if (pile.id === "stock") return { ...state, stock: pile };
  if (pile.id === "waste") return { ...state, waste: pile };
  if (pile.kind === "tableau") {
    const idx = Number(pile.id.slice("tableau-".length));
    const arr = Array.from(state.tableau);
    arr[idx] = pile;
    return { ...state, tableau: arr as unknown as GameState["tableau"] };
  }
  if (pile.kind === "foundation") {
    const idx = Number(pile.id.slice("foundation-".length));
    const arr = Array.from(state.foundations);
    arr[idx] = pile;
    return {
      ...state,
      foundations: arr as unknown as GameState["foundations"],
    };
  }
  return state;
}

// Slice cards from the source pile starting at cardId. For tableau sources we
// take the card and everything stacked on top of it; for waste/foundation we
// only ever take the top card (and only if cardId matches it).
function takeCards(
  source: Pile,
  cardId: CardId,
): { taken: Pile["cards"]; remaining: Pile["cards"] } | null {
  if (source.kind === "tableau") {
    const idx = source.cards.findIndex((c) => c.id === cardId);
    if (idx === -1) return null;
    const taken = source.cards.slice(idx);
    if (taken.some((c) => !c.faceUp)) return null;
    const remaining = source.cards.slice(0, idx);
    return { taken, remaining };
  }
  // waste / foundation: only the top card is movable
  const top = topCardOf(source);
  if (top === null || top.id !== cardId) return null;
  return { taken: [top], remaining: source.cards.slice(0, -1) };
}

function applyPileMove(
  state: GameState,
  from: PileId,
  to: PileId,
  cardId: CardId,
  nowMs: number,
): ApplyResult {
  if (from === to) return { ok: false, reason: "same-pile" };

  const source = getPile(state, from);
  const target = getPile(state, to);
  if (!source || !target) return { ok: false, reason: "unknown-pile" };
  if (source.kind === "stock") return { ok: false, reason: "stock-not-movable" };

  const slice = takeCards(source, cardId);
  if (!slice) return { ok: false, reason: "card-not-found" };

  // Validate per target kind. Foundations only accept a single card.
  if (target.kind === "foundation") {
    if (slice.taken.length !== 1) return { ok: false, reason: "foundation-single-card" };
    if (!canPlaceOnFoundation(slice.taken[0], target)) {
      return { ok: false, reason: "illegal-foundation" };
    }
  } else if (target.kind === "tableau") {
    if (!canPlaceOnTableau(slice.taken, target)) {
      return { ok: false, reason: "illegal-tableau" };
    }
  } else {
    return { ok: false, reason: "illegal-target" };
  }

  // Build new source pile (with possible auto-flip).
  const sourceAfterTake: Pile = { ...source, cards: slice.remaining };
  const { pile: sourceAfterFlip, flipped } = flipTopIfNeeded(sourceAfterTake);

  const targetAfter: Pile = {
    ...target,
    cards: target.cards.concat(slice.taken),
  };

  let next = withPile(state, sourceAfterFlip);
  next = withPile(next, targetAfter);

  const moveDelta = moveScoreDelta(source.kind, target.kind);
  const flipDelta = flipped ? flipReveal() : 0;

  next = {
    ...next,
    score: next.score + moveDelta + flipDelta,
    moveCount: next.moveCount + 1,
    startedAt: next.startedAt ?? nowMs,
    status: next.status === "idle" ? "playing" : next.status,
  };

  if (isWon(next)) {
    // Drain the running session into the accumulator and freeze the timer
    // before flipping to "won". Without this drain, elapsedMs() (which only
    // counts a running session for status === "playing") would silently
    // discard the time between the last resume and the winning move — the
    // statistics dialog would then show 00:00 for an unbroken win, and the
    // win modal would display a stale or zero time.
    const sessionMs =
      next.startedAt !== null ? Math.max(0, nowMs - next.startedAt) : 0;
    next = {
      ...next,
      accumulatedMs: next.accumulatedMs + sessionMs,
      startedAt: null,
      status: "won",
    };
  }

  return { ok: true, state: next };
}

function findBestFoundation(
  state: GameState,
  cardId: CardId,
  fromPileId: PileId,
): PileId | null {
  const source = getPile(state, fromPileId);
  if (!source) return null;
  const top = topCardOf(source);
  if (!top || top.id !== cardId) return null;
  for (let i = 0; i < state.foundations.length; i++) {
    if (canPlaceOnFoundation(top, state.foundations[i])) {
      return `foundation-${i}` as PileId;
    }
  }
  return null;
}

// Single entry point the UI calls. Returns a fully-resolved next state or a
// reason string for why the move was rejected.
//
// `nowMs` is plumbed through so the timer-mutating branches (start of first
// move, win-state drain) stay deterministic in tests. Defaults to Date.now()
// for normal callers — the store doesn't pass a clock.
export function tryApplyMove(
  state: GameState,
  intent: MoveIntent,
  nowMs: number = Date.now(),
): ApplyResult {
  // No plays while paused — the UI also locks input, this is the
  // defense-in-depth check so programmatic flows can't sneak a move through.
  if (state.status === "paused") {
    return { ok: false, reason: "paused" };
  }
  switch (intent.kind) {
    case "draw":
      return drawFromStock(state);
    case "recycle":
      return recycleWaste(state);
    case "move":
      return applyPileMove(state, intent.from, intent.to, intent.cardId, nowMs);
    case "autoMoveToFoundation": {
      const source = getPile(state, intent.from);
      if (!source) return { ok: false, reason: "unknown-pile" };
      const top = topCardOf(source);
      if (!top) return { ok: false, reason: "empty-pile" };
      const target = findBestFoundation(state, top.id, intent.from);
      if (!target) return { ok: false, reason: "no-foundation" };
      return applyPileMove(state, intent.from, target, top.id, nowMs);
    }
  }
}

// Heuristic for click-to-move: foundation first, then a tableau column with
// the highest card-count underneath (preserves longer runs), else any legal
// tableau, else null.
export function findBestDestination(
  state: GameState,
  fromPileId: PileId,
  cardId: CardId,
): PileId | null {
  const source = getPile(state, fromPileId);
  if (!source) return null;
  const slice = takeCards(source, cardId);
  if (!slice) return null;

  // Single card → try foundation first.
  if (slice.taken.length === 1) {
    for (let i = 0; i < state.foundations.length; i++) {
      if (canPlaceOnFoundation(slice.taken[0], state.foundations[i])) {
        return `foundation-${i}` as PileId;
      }
    }
  }

  // Tableau: prefer non-empty target with most cards underneath; tie → first.
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 0; i < state.tableau.length; i++) {
    const t = state.tableau[i];
    if (t.id === fromPileId) continue;
    if (canPlaceOnTableau(slice.taken, t)) {
      const score = t.cards.length === 0 ? 0 : t.cards.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
  }
  if (bestIdx >= 0) return `tableau-${bestIdx}` as PileId;
  return null;
}

export function isLegalMove(state: GameState, intent: MoveIntent): boolean {
  const result = tryApplyMove(state, intent);
  return result.ok;
}

// Re-export internal helpers used by tests / autoComplete.
export { getPile };
