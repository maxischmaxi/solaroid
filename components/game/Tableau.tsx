"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Card } from "./Card";
import { DraggableCard } from "./DraggableCard";
import { DroppablePile } from "./DroppablePile";
import type { TableauIndex } from "@/lib/game/types";
// Note: tableauOffset cards position themselves; non-draggable face-down cards
// use the inline tableau-card class.

interface TableauProps {
  index: TableauIndex;
}

export function Tableau({ index }: TableauProps) {
  const pile = useGameStore((s) => s.game.tableau[index]);

  return (
    <DroppablePile pileId={pile.id}>
      <div className="tableau-column">
        {pile.cards.length === 0 && (
          <div className="card-slot card-slot--empty" aria-label="Leerer Stapel" />
        )}
        {pile.cards.map((card, i) => {
          const top = `calc(var(--fan-down) * ${i})`;
          if (!card.faceUp) {
            return (
              <div
                key={card.id}
                className="tableau-card"
                style={{ top }}
              >
                <Card suit={card.suit} rank={card.rank} back />
              </div>
            );
          }
          return (
            <DraggableCard
              key={card.id}
              card={card}
              source={{ pileId: pile.id, cardIndex: i }}
              style={{ top, position: "absolute", left: 0 }}
              tableauOffset
            />
          );
        })}
      </div>
    </DroppablePile>
  );
}
