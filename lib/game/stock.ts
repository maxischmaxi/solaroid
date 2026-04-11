import { recyclePenalty } from "./scoring";
import type { ApplyResult, Card, GameState, Pile } from "./types";

// Draw from stock: move up to drawMode cards from stock top → waste top, all face-up.
// If stock is empty, this is illegal — caller should explicitly recycle instead.
export function drawFromStock(state: GameState): ApplyResult {
  if (state.stock.cards.length === 0) {
    return { ok: false, reason: "stock-empty" };
  }
  const count = Math.min(state.drawMode, state.stock.cards.length);

  // Cards are drawn from the top of the stock; the LAST drawn card lands on top
  // of the waste, so iterate top-down and append in that order.
  const stockCards = state.stock.cards.slice();
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = stockCards.pop()!; // top of stock
    drawn.push({ ...card, faceUp: true });
  }
  // Append in draw order: first drawn lands first, last drawn ends up on top.
  const newWasteCards = state.waste.cards.concat(drawn);

  const nextStock: Pile = { ...state.stock, cards: stockCards };
  const nextWaste: Pile = { ...state.waste, cards: newWasteCards };

  const next: GameState = {
    ...state,
    stock: nextStock,
    waste: nextWaste,
    moveCount: state.moveCount + 1,
    startedAt: state.startedAt ?? Date.now(),
    status: state.status === "idle" ? "playing" : state.status,
  };
  return { ok: true, state: next };
}

// Recycle: only legal when stock is empty and waste is non-empty. Moves all of
// waste back into stock face-down, in reverse order, and increments stockCycles.
// Applies the recycle penalty to score.
export function recycleWaste(state: GameState): ApplyResult {
  if (state.stock.cards.length !== 0) {
    return { ok: false, reason: "stock-not-empty" };
  }
  if (state.waste.cards.length === 0) {
    return { ok: false, reason: "waste-empty" };
  }
  // Reverse waste so the original top of waste ends up at the bottom of stock.
  const newStockCards: Card[] = state.waste.cards
    .slice()
    .reverse()
    .map((c) => ({ ...c, faceUp: false }));

  const next: GameState = {
    ...state,
    stock: { ...state.stock, cards: newStockCards },
    waste: { ...state.waste, cards: [] },
    stockCycles: state.stockCycles + 1,
    score: state.score + recyclePenalty(state.drawMode),
    moveCount: state.moveCount + 1,
    startedAt: state.startedAt ?? Date.now(),
    status: state.status === "idle" ? "playing" : state.status,
  };
  return { ok: true, state: next };
}
