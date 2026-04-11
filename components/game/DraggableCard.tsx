"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { Card as CardType, PileId } from "@/lib/game/types";
import { useGameStore } from "@/lib/store/gameStore";
import { Card } from "./Card";

export interface DragSource {
  pileId: PileId;
  /** Index of the card within a tableau pile (only set for tableau sources). */
  cardIndex?: number;
}

interface DraggableCardProps {
  card: CardType;
  source: DragSource;
  style?: CSSProperties;
  /** True if this card is part of a fanned tableau column. */
  tableauOffset?: boolean;
}

export function DraggableCard({
  card,
  source,
  style,
  tableauOffset,
}: DraggableCardProps) {
  const dispatchMove = useGameStore((s) => s.dispatchMove);
  const findBest = useGameStore((s) => s.findBestDestination);

  const { attributes, listeners, setNodeRef, isDragging, transform } =
    useDraggable({
      id: `${source.pileId}:${card.id}`,
      data: { source, cardId: card.id },
    });

  const onClick = () => {
    // Single-tap auto-move: try foundation, then best tableau.
    const target = findBest(source.pileId, card.id);
    if (!target) return;
    dispatchMove({
      kind: "move",
      from: source.pileId,
      to: target,
      cardId: card.id,
    });
  };

  const computedStyle: CSSProperties = {
    ...(tableauOffset ? { position: "absolute", left: 0 } : {}),
    width: "var(--card-w)",
    height: "var(--card-h)",
    touchAction: "none",
    cursor: "grab",
    ...style,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : style?.transform,
    viewTransitionName: `card-${card.id}`,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={computedStyle}
      className={tableauOffset ? "tableau-card" : ""}
    >
      <Card suit={card.suit} rank={card.rank} dragging={isDragging} />
    </div>
  );
}
