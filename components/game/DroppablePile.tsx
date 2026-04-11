"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { PileId } from "@/lib/game/types";

interface DroppablePileProps {
  pileId: PileId;
  children: ReactNode;
}

export function DroppablePile({ pileId, children }: DroppablePileProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: pileId,
    data: { pileId },
  });

  // Highlight tint when a card is hovering over this drop zone.
  const isHovered = isOver && active !== null;

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-shadow rounded-[6%] ${isHovered ? "ring-2 ring-emerald-300/80" : ""}`}
      data-pile-id={pileId}
    >
      {children}
    </div>
  );
}
