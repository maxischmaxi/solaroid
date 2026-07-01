// Hint engine: pick the single most useful action the player could take
// from the current state — and say WHY, so the hint feels like a thinking
// partner instead of a legal-move enumerator.
//
// The engine generates every sensible candidate move, scores it with
// distilled Klondike strategy, and (optionally) verifies promising but
// ambiguous candidates with a one-move lookahead simulation:
//
//   * Foundation plays are only "obviously right" when they are SAFE by the
//     classic rule (both opposite-color foundations are within one rank) —
//     an unsafe foundation play can strand tableau cards that still need
//     the moved card as a landing spot.
//   * Reveal moves are ranked by how buried the source column is: freeing
//     the column with the most face-down cards attacks the biggest unknown.
//   * A fully face-up column is only worth relocating when a king is
//     actually waiting for the space it creates.
//   * Waste→tableau plays are simulated: if they unlock a new reveal or a
//     new safe foundation play they rank high; if they merely park a card
//     they rank BELOW drawing from the stock (the old engine's biggest trap).
//
// Lookahead never peeks at face-down information: simulated moves that
// reveal a card are scored by the reveal itself, not by what flips over.
//
// Pure data in, pure data out. The animation layer turns the result into
// pixels; the store turns a `null` return into the game-over flag.

import { KING, colorOf } from "./constants";
import { tryApplyMove } from "./moves";
import { canPlaceOnFoundation, canPlaceOnTableau, topCardOf } from "./rules";
import type { Card, CardId, GameState, PileId, Suit } from "./types";

export type HintReason =
  | "foundation-safe"
  | "foundation"
  | "reveal"
  | "empty-for-king"
  | "king-to-empty"
  | "waste-unlock"
  | "waste-tableau";

export type Hint =
  | {
      kind: "move";
      from: PileId;
      to: PileId;
      cardId: CardId;
      reason: HintReason;
    }
  | { kind: "stock"; action: "draw" | "recycle"; draws: number };

export interface FindHintOptions {
  /**
   * Verify ambiguous candidates (unsafe foundation plays, waste→tableau)
   * with a one-move simulation. Costs a handful of tryApplyMove calls per
   * hint; the greedy winnability solver disables it for throughput.
   */
  lookahead?: boolean;
}

/* ---------- Scoring ---------- */

const SCORE = {
  safeFoundationTableau: 100,
  safeFoundationWaste: 95,
  reveal: 78,
  revealPerDown: 4,
  emptyForKing: 70,
  kingToEmpty: 65,
  unsafeFoundationTableau: 55,
  unsafeFoundationWaste: 50,
  wasteUnlock: 45,
  wasteUnlockPer: 10,
  stock: 30,
  wastePark: 25,
  unsafeRevealBonus: 20,
  chainBonus: 15,
} as const;

interface Candidate {
  hint: Hint;
  score: number;
}

/**
 * Return the recommended next action, or `null` if the player is truly
 * stuck (no useful move and nothing reachable in stock or waste).
 */
export function findHint(
  state: GameState,
  options: FindHintOptions = {},
): Hint | null {
  const lookahead = options.lookahead !== false;
  const candidates: Candidate[] = [];
  const baselineKeys = lookahead ? usefulMoveKeys(state) : null;

  collectFoundationCandidates(state, lookahead, baselineKeys, candidates);
  collectRevealCandidates(state, candidates);
  collectEmptyColumnCandidates(state, candidates);
  collectWasteCandidates(state, lookahead, baselineKeys, candidates);
  collectStockCandidate(state, candidates);

  let best: Candidate | null = null;
  for (const c of candidates) {
    if (c.score <= 0) continue;
    if (!best || c.score > best.score) best = c;
  }
  return best?.hint ?? null;
}

/* ---------- Candidate collectors ---------- */

function collectFoundationCandidates(
  state: GameState,
  lookahead: boolean,
  baselineKeys: Set<string> | null,
  out: Candidate[],
): void {
  // Tableau tops.
  for (const pile of state.tableau) {
    const top = topCardOf(pile);
    if (!top || !top.faceUp) continue;
    const fIdx = foundationIndexFor(state, top);
    if (fIdx === -1) continue;
    const to = `foundation-${fIdx}` as PileId;
    const hint: Hint = {
      kind: "move",
      from: pile.id,
      to,
      cardId: top.id,
      reason: "foundation-safe",
    };
    if (isSafeFoundationPlay(top, state)) {
      out.push({ hint, score: SCORE.safeFoundationTableau });
      continue;
    }
    // Unsafe: only strong when it also uncovers something or opens a chain.
    let score = SCORE.unsafeFoundationTableau;
    const below = pile.cards[pile.cards.length - 2];
    if (below && !below.faceUp) score += SCORE.unsafeRevealBonus;
    if (lookahead && baselineKeys) {
      score += chainBonus(state, hint, baselineKeys);
    }
    out.push({ hint: { ...hint, reason: "foundation" }, score });
  }

  // Waste top.
  const wasteTop = topCardOf(state.waste);
  if (wasteTop && wasteTop.faceUp) {
    const fIdx = foundationIndexFor(state, wasteTop);
    if (fIdx !== -1) {
      const hint: Hint = {
        kind: "move",
        from: state.waste.id,
        to: `foundation-${fIdx}` as PileId,
        cardId: wasteTop.id,
        reason: "foundation-safe",
      };
      if (isSafeFoundationPlay(wasteTop, state)) {
        out.push({ hint, score: SCORE.safeFoundationWaste });
      } else {
        let score = SCORE.unsafeFoundationWaste;
        if (lookahead && baselineKeys) {
          score += chainBonus(state, hint, baselineKeys);
        }
        out.push({ hint: { ...hint, reason: "foundation" }, score });
      }
    }
  }
}

/**
 * Tableau-run → tableau moves that flip a face-down card. Ranked by how many
 * face-down cards the source column still hides: the most buried column is
 * the most urgent one to attack.
 */
function collectRevealCandidates(state: GameState, out: Candidate[]): void {
  for (const src of state.tableau) {
    const idx = firstFaceUpIndex(src);
    if (idx <= 0) continue; // -1 = empty/no face-up, 0 = nothing to reveal
    const run = src.cards.slice(idx);
    const score = SCORE.reveal + SCORE.revealPerDown * idx;
    for (const dst of state.tableau) {
      if (dst.id === src.id) continue;
      if (!canPlaceOnTableau(run, dst)) continue;
      out.push({
        hint: {
          kind: "move",
          from: src.id,
          to: dst.id,
          cardId: run[0].id,
          reason: "reveal",
        },
        score,
      });
    }
  }
}

/**
 * Relocating a fully face-up column reveals nothing — but it CREATES an
 * empty column, which is gold when a king is waiting for the space. Only
 * suggested when no column is empty yet and a useful king actually exists.
 */
function collectEmptyColumnCandidates(
  state: GameState,
  out: Candidate[],
): void {
  if (state.tableau.some((t) => t.cards.length === 0)) return;
  if (!kingWaitsForSpace(state)) return;

  for (const src of state.tableau) {
    if (src.cards.length === 0) continue;
    const idx = firstFaceUpIndex(src);
    if (idx !== 0) continue; // whole column must be face-up
    const run = src.cards;
    if (run[0].rank === KING) continue; // king already sits on the floor
    for (const dst of state.tableau) {
      if (dst.id === src.id || dst.cards.length === 0) continue;
      if (!canPlaceOnTableau(run, dst)) continue;
      out.push({
        hint: {
          kind: "move",
          from: src.id,
          to: dst.id,
          cardId: run[0].id,
          reason: "empty-for-king",
        },
        score: SCORE.emptyForKing,
      });
    }
  }
}

/**
 * Waste-top → tableau. A king to an empty column frees the waste and claims
 * space. Everything else is simulated: unlocking a new reveal or safe
 * foundation play ranks well; merely parking a card ranks below drawing.
 */
function collectWasteCandidates(
  state: GameState,
  lookahead: boolean,
  baselineKeys: Set<string> | null,
  out: Candidate[],
): void {
  const wasteTop = topCardOf(state.waste);
  if (!wasteTop || !wasteTop.faceUp) return;

  for (const dst of state.tableau) {
    if (!canPlaceOnTableau([wasteTop], dst)) continue;
    const hint: Hint = {
      kind: "move",
      from: state.waste.id,
      to: dst.id,
      cardId: wasteTop.id,
      reason: "waste-tableau",
    };

    if (wasteTop.rank === KING && dst.cards.length === 0) {
      out.push({
        hint: { ...hint, reason: "king-to-empty" },
        score: SCORE.kingToEmpty,
      });
      continue;
    }

    if (lookahead && baselineKeys) {
      const unlocked = countNewUsefulMoves(state, hint, baselineKeys);
      if (unlocked > 0) {
        out.push({
          hint: { ...hint, reason: "waste-unlock" },
          score:
            SCORE.wasteUnlock + SCORE.wasteUnlockPer * Math.min(unlocked, 2),
        });
        continue;
      }
    }
    out.push({ hint, score: SCORE.wastePark });
  }
}

function collectStockCandidate(state: GameState, out: Candidate[]): void {
  if (state.stock.cards.length === 0 && state.waste.cards.length === 0) return;
  // A waste top that is playable RIGHT NOW is no reason to click the stock —
  // cycling back around to the same card would be a pointless detour. Only
  // cards that are currently out of reach justify drawing.
  const wasteTop = topCardOf(state.waste);
  const wasteTopPlayableNow =
    wasteTop !== null &&
    wasteTop.faceUp &&
    (foundationIndexFor(state, wasteTop) !== -1 ||
      state.tableau.some((t) => canPlaceOnTableau([wasteTop], t)));
  const draws = countClicksToPlayable(
    state,
    wasteTopPlayableNow ? wasteTop.id : undefined,
  );
  if (draws <= 0) return;
  const action = state.stock.cards.length > 0 ? "draw" : "recycle";
  out.push({
    hint: { kind: "stock", action, draws },
    score: SCORE.stock,
  });
}

/* ---------- Strategy helpers ---------- */

function firstFaceUpIndex(pile: GameState["tableau"][number]): number {
  return pile.cards.findIndex((c) => c.faceUp);
}

/** Index of a foundation that accepts the card, or -1. */
function foundationIndexFor(state: GameState, card: Card): number {
  for (let i = 0; i < state.foundations.length; i++) {
    if (canPlaceOnFoundation(card, state.foundations[i])) return i;
  }
  return -1;
}

function foundationRankBySuit(state: GameState): Record<Suit, number> {
  const ranks: Record<Suit, number> = {
    spades: 0,
    hearts: 0,
    diamonds: 0,
    clubs: 0,
  };
  for (const f of state.foundations) {
    const top = topCardOf(f);
    if (top) ranks[top.suit] = top.rank;
  }
  return ranks;
}

/**
 * Classic safe-autoplay rule: a card can never be needed in the tableau
 * again once both opposite-color foundations have reached the rank below
 * it (aces and twos are always safe).
 */
function isSafeFoundationPlay(card: Card, state: GameState): boolean {
  if (card.rank <= 2) return true;
  const ranks = foundationRankBySuit(state);
  const opposite: Suit[] =
    colorOf(card.suit) === "red" ? ["spades", "clubs"] : ["hearts", "diamonds"];
  return opposite.every((s) => ranks[s] >= card.rank - 1);
}

/** Is any king around that could use an empty column right now? */
function kingWaitsForSpace(state: GameState): boolean {
  const wasteTop = topCardOf(state.waste);
  if (wasteTop && wasteTop.faceUp && wasteTop.rank === KING) return true;
  for (const t of state.tableau) {
    const idx = firstFaceUpIndex(t);
    // A king with face-down cards underneath gains a reveal move from the
    // new space; a floor-sitting king would gain nothing.
    if (idx > 0 && t.cards[idx].rank === KING) return true;
  }
  return false;
}

/**
 * Fingerprint of the state's clearly-useful moves (safe foundation plays and
 * reveal moves). Lookahead compares fingerprints before/after a candidate to
 * count what the candidate genuinely unlocks.
 */
function usefulMoveKeys(state: GameState): Set<string> {
  const keys = new Set<string>();

  for (const pile of state.tableau) {
    const top = topCardOf(pile);
    if (
      top &&
      top.faceUp &&
      foundationIndexFor(state, top) !== -1 &&
      isSafeFoundationPlay(top, state)
    ) {
      keys.add(`f:${top.id}`);
    }
  }
  const wasteTop = topCardOf(state.waste);
  if (
    wasteTop &&
    wasteTop.faceUp &&
    foundationIndexFor(state, wasteTop) !== -1 &&
    isSafeFoundationPlay(wasteTop, state)
  ) {
    keys.add(`f:${wasteTop.id}`);
  }

  for (const src of state.tableau) {
    const idx = firstFaceUpIndex(src);
    if (idx <= 0) continue;
    const run = src.cards.slice(idx);
    for (const dst of state.tableau) {
      if (dst.id === src.id) continue;
      if (canPlaceOnTableau(run, dst)) {
        keys.add(`r:${run[0].id}>${dst.id}`);
      }
    }
  }
  return keys;
}

/** Simulate a move hint and count useful moves that exist only afterwards. */
function countNewUsefulMoves(
  state: GameState,
  hint: Hint & { kind: "move" },
  baselineKeys: Set<string>,
): number {
  const result = tryApplyMove(state, {
    kind: "move",
    from: hint.from,
    to: hint.to,
    cardId: hint.cardId,
  });
  if (!result.ok) return 0;
  let count = 0;
  for (const key of usefulMoveKeys(result.state)) {
    if (!baselineKeys.has(key)) count++;
  }
  return count;
}

function chainBonus(
  state: GameState,
  hint: Hint & { kind: "move" },
  baselineKeys: Set<string>,
): number {
  return countNewUsefulMoves(state, hint, baselineKeys) > 0
    ? SCORE.chainBonus
    : 0;
}

/**
 * Simulate drawing through the stock (and recycling if necessary) to find
 * how many clicks on the stock pile it takes to reach the first playable
 * card. Returns 0 if no card is reachable (game is stuck).
 *
 * `ignoreCardId` excludes a card from counting as a find — used for a waste
 * top that is already playable without touching the stock. (Playability of
 * a fixed card never changes during the simulation, so skipping it is safe.)
 */
function countClicksToPlayable(
  state: GameState,
  ignoreCardId?: CardId,
): number {
  const { drawMode } = state;
  let stockCards = state.stock.cards.slice();
  let wasteCards = state.waste.cards.slice();
  let clicks = 0;
  let recycled = false;

  // Safety: at most one full pass through stock + one recycle + one more pass.
  const maxClicks = stockCards.length + wasteCards.length + 2;

  // If the game is already at its redeal limit we can't simulate a recycle.
  const canRecycle =
    state.redealLimit === null || state.stockCycles < state.redealLimit;

  while (clicks < maxClicks) {
    if (stockCards.length === 0) {
      if (wasteCards.length === 0 || recycled || !canRecycle) break;
      // Recycle: waste reverses into stock.
      stockCards = wasteCards.slice().reverse();
      wasteCards = [];
      clicks++;
      recycled = true;
      continue;
    }

    // Draw min(drawMode, remaining) cards from the top of stock.
    const count = Math.min(drawMode, stockCards.length);
    const drawn: typeof stockCards = [];
    for (let i = 0; i < count; i++) {
      drawn.push(stockCards.pop()!);
    }
    wasteCards = wasteCards.concat(drawn);
    clicks++;

    // The waste top (last element) is the newly accessible card.
    const top = wasteCards[wasteCards.length - 1];
    if (top.id === ignoreCardId) continue;
    const c = top.faceUp ? top : { ...top, faceUp: true as const };
    for (const f of state.foundations) {
      if (canPlaceOnFoundation(c, f)) return clicks;
    }
    for (const t of state.tableau) {
      if (canPlaceOnTableau([c], t)) return clicks;
    }
  }

  return 0; // stuck
}
