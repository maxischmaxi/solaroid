"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Card } from "./Card";

export function Stock() {
  const stockLen = useGameStore((s) => s.game.stock.cards.length);
  const wasteLen = useGameStore((s) => s.game.waste.cards.length);
  const drawFromStock = useGameStore((s) => s.drawFromStock);
  const recycleWaste = useGameStore((s) => s.recycleWaste);

  const onClick = () => {
    if (stockLen > 0) {
      drawFromStock();
    } else if (wasteLen > 0) {
      recycleWaste();
    }
  };

  const isEmpty = stockLen === 0;

  return (
    <button
      onClick={onClick}
      className={`card-slot ${isEmpty ? "card-slot--empty" : ""} cursor-pointer`}
      aria-label={
        isEmpty
          ? wasteLen > 0
            ? "Stock recyceln"
            : "Stock leer"
          : `Stock ziehen (${stockLen})`
      }
    >
      {!isEmpty && (
        <Card suit="spades" rank={1} back />
      )}
      {isEmpty && wasteLen > 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-2xl">
          ↻
        </div>
      )}
    </button>
  );
}
