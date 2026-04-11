"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Card } from "./Card";
import { DraggableCard } from "./DraggableCard";
import { DroppablePile } from "./DroppablePile";
import type { FoundationIndex } from "@/lib/game/types";

interface FoundationProps {
  index: FoundationIndex;
}

export function Foundation({ index }: FoundationProps) {
  const pile = useGameStore((s) => s.game.foundations[index]);
  const top = pile.cards[pile.cards.length - 1] ?? null;

  return (
    <DroppablePile pileId={pile.id}>
      {top === null ? (
        <div
          className="card-slot card-slot--empty flex items-center justify-center text-white/30 text-2xl"
          aria-label={`Foundation ${index + 1} leer`}
        >
          ♢
        </div>
      ) : (
        <div className="card-slot">
          <DraggableCard
            card={top}
            source={{ pileId: pile.id }}
          />
        </div>
      )}
    </DroppablePile>
  );
}
