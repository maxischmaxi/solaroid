"use client";

// Off-screen DOM mirror that gives screen-reader and keyboard users a way to
// interact with the canvas board. Visually clipped out of view, but tabbable
// and announced by assistive tech. Mirrors the same aria-labels and click
// affordances the previous DOM components provided.

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import type {
  Card,
  GameState,
  Pile,
  PileId,
  Suit,
} from "@/lib/game/types";
import { colorOf } from "@/lib/game/constants";

const SUIT_NAMES_DE: Record<Suit, string> = {
  spades: "Pik",
  hearts: "Herz",
  diamonds: "Karo",
  clubs: "Kreuz",
};

const RANK_NAMES_DE: Record<number, string> = {
  1: "Ass",
  11: "Bube",
  12: "Dame",
  13: "König",
};

function rankName(rank: number): string {
  return RANK_NAMES_DE[rank] ?? String(rank);
}

function cardName(card: Card): string {
  const suit = SUIT_NAMES_DE[card.suit];
  return `${rankName(card.rank)} ${suit}`;
}

function pileLabel(pileId: PileId, game: GameState): string {
  if (pileId === "stock") {
    if (game.stock.cards.length > 0) {
      return `Stock ziehen (${game.stock.cards.length} Karten)`;
    }
    return game.waste.cards.length > 0 ? "Stock recyceln" : "Stock leer";
  }
  if (pileId === "waste") {
    const top = game.waste.cards[game.waste.cards.length - 1];
    return top ? `Waste, oben: ${cardName(top)}` : "Waste leer";
  }
  if (pileId.startsWith("foundation-")) {
    const idx = Number(pileId.slice("foundation-".length));
    const pile = game.foundations[idx];
    const top = pile.cards[pile.cards.length - 1];
    return top
      ? `Foundation ${idx + 1}, oben: ${cardName(top)}`
      : `Foundation ${idx + 1} leer`;
  }
  if (pileId.startsWith("tableau-")) {
    const idx = Number(pileId.slice("tableau-".length));
    const pile = game.tableau[idx];
    if (pile.cards.length === 0) return `Tableau ${idx + 1} leer`;
    const top = pile.cards[pile.cards.length - 1];
    return `Tableau ${idx + 1}, ${pile.cards.length} Karten, oben: ${cardName(top)}`;
  }
  return pileId;
}

const PILE_ORDER: PileId[] = [
  "stock",
  "waste",
  "foundation-0",
  "foundation-1",
  "foundation-2",
  "foundation-3",
  "tableau-0",
  "tableau-1",
  "tableau-2",
  "tableau-3",
  "tableau-4",
  "tableau-5",
  "tableau-6",
];

const SR_ONLY_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function CanvasBoardA11y() {
  const game = useGameStore((s) => s.game);
  const moveCount = useGameStore((s) => s.game.moveCount);
  const dispatchMove = useGameStore((s) => s.dispatchMove);
  const drawFromStock = useGameStore((s) => s.drawFromStock);
  const recycleWaste = useGameStore((s) => s.recycleWaste);
  const findBest = useGameStore((s) => s.findBestDestination);

  const [announcement, setAnnouncement] = useState("");
  const lastAnnouncedMove = useRef<number>(moveCount);

  // Build a one-line move announcement whenever moveCount increments.
  useEffect(() => {
    if (moveCount === lastAnnouncedMove.current) return;
    lastAnnouncedMove.current = moveCount;
    setAnnouncement(`Zug ${moveCount}. Punkte: ${game.score}.`);
  }, [moveCount, game.score]);

  const handleClick = (pileId: PileId): void => {
    if (pileId === "stock") {
      if (game.stock.cards.length > 0) drawFromStock();
      else if (game.waste.cards.length > 0) recycleWaste();
      return;
    }
    // For card piles, auto-move the top card if possible.
    const pile = pileById(game, pileId);
    if (!pile) return;
    const top = pile.cards[pile.cards.length - 1];
    if (!top || !top.faceUp) return;
    const target = findBest(pileId, top.id);
    if (!target) return;
    dispatchMove({ kind: "move", from: pileId, to: target, cardId: top.id });
  };

  return (
    <>
      <ul aria-label="Solitaire Stapel" style={SR_ONLY_STYLE}>
        {PILE_ORDER.map((pileId) => (
          <li key={pileId}>
            <button
              type="button"
              aria-label={pileLabel(pileId, game)}
              onClick={() => handleClick(pileId)}
            >
              {pileLabel(pileId, game)}
            </button>
          </li>
        ))}
      </ul>
      <div role="status" aria-live="polite" style={SR_ONLY_STYLE}>
        {announcement}
      </div>
    </>
  );
}

function pileById(game: GameState, pileId: PileId): Pile | null {
  if (pileId === "stock") return game.stock;
  if (pileId === "waste") return game.waste;
  if (pileId.startsWith("foundation-")) {
    const i = Number(pileId.slice("foundation-".length));
    return game.foundations[i] ?? null;
  }
  if (pileId.startsWith("tableau-")) {
    const i = Number(pileId.slice("tableau-".length));
    return game.tableau[i] ?? null;
  }
  return null;
}

// Suppress unused-import warning for the colorOf helper (kept here for
// future expansion if we want to announce suit color).
void colorOf;
