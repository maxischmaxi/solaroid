"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Card } from "./Card";
import { DraggableCard } from "./DraggableCard";

export function Waste() {
  const waste = useGameStore((s) => s.game.waste);
  const drawMode = useGameStore((s) => s.settings.drawMode);

  if (waste.cards.length === 0) {
    return (
      <div
        className="card-slot card-slot--empty"
        aria-label="Waste leer"
      />
    );
  }

  // Show last (drawMode) cards as a small horizontal fan; only the top is draggable.
  const visibleCount = Math.min(drawMode, waste.cards.length);
  const visible = waste.cards.slice(waste.cards.length - visibleCount);
  const topIndex = visible.length - 1;

  return (
    <div className="card-slot relative" aria-label="Waste">
      {visible.map((card, i) => {
        const isTop = i === topIndex;
        const offsetX = `calc(var(--card-w) * ${i * 0.18})`;
        const style = { left: offsetX };
        if (isTop) {
          return (
            <DraggableCard
              key={card.id}
              card={card}
              source={{ pileId: "waste" }}
              style={style}
            />
          );
        }
        return (
          <div
            key={card.id}
            className="absolute top-0"
            style={{
              left: offsetX,
              width: "var(--card-w)",
              height: "var(--card-h)",
            }}
          >
            <Card suit={card.suit} rank={card.rank} />
          </div>
        );
      })}
    </div>
  );
}
