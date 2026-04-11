"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Board } from "./Board";
import { BoardSkeleton } from "./BoardSkeleton";
import { Card } from "./Card";
import { Header } from "./Header";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { StatsModal } from "@/components/modals/StatsModal";
import { WinModal } from "@/components/modals/WinModal";
import type { Card as CardType, PileId } from "@/lib/game/types";
import type { DragSource } from "./DraggableCard";

interface ActiveDrag {
  cards: CardType[];
  source: DragSource;
}

export function GameShell() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const gameStatus = useGameStore((s) => s.game.status);
  const dispatchMove = useGameStore((s) => s.dispatchMove);
  const autoCompleteEnabled = useGameStore(
    (s) => s.settings.autoCompleteEnabled,
  );
  const canAutoComplete = useGameStore((s) => s.canAutoComplete());
  const autoComplete = useGameStore((s) => s.autoComplete);
  const autoCompleteRunning = useGameStore((s) => s.autoCompleteRunning);

  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  // Initial hydration from localStorage on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Open the win modal when the game transitions to "won".
  useEffect(() => {
    if (gameStatus === "won") {
      setWinOpen(true);
    }
  }, [gameStatus]);

  // Auto-trigger auto-complete when eligible (and the user has it enabled).
  useEffect(() => {
    if (canAutoComplete && autoCompleteEnabled && !autoCompleteRunning) {
      autoComplete();
    }
  }, [canAutoComplete, autoCompleteEnabled, autoCompleteRunning, autoComplete]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as
      | { source: DragSource; cardId: string }
      | undefined;
    if (!data) return;
    const game = useGameStore.getState().game;

    let cards: CardType[] = [];
    if (data.source.pileId.startsWith("tableau-")) {
      const idx = Number(data.source.pileId.slice("tableau-".length));
      const pile = game.tableau[idx];
      const cardIdx = pile.cards.findIndex((c) => c.id === data.cardId);
      if (cardIdx === -1) return;
      cards = pile.cards.slice(cardIdx);
    } else if (data.source.pileId === "waste") {
      const top = game.waste.cards[game.waste.cards.length - 1];
      if (top) cards = [top];
    } else if (data.source.pileId.startsWith("foundation-")) {
      const idx = Number(data.source.pileId.slice("foundation-".length));
      const top = game.foundations[idx].cards[
        game.foundations[idx].cards.length - 1
      ];
      if (top) cards = [top];
    }
    setActiveDrag({ cards, source: data.source });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const drag = activeDrag;
    setActiveDrag(null);
    if (!drag || !e.over) return;
    const targetId = e.over.id as PileId;
    const moved = drag.cards[0];
    if (!moved) return;

    const dispatch = () =>
      dispatchMove({
        kind: "move",
        from: drag.source.pileId,
        to: targetId,
        cardId: moved.id,
      });

    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document
    ) {
      const docWithVT = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      docWithVT.startViewTransition?.(dispatch);
    } else {
      dispatch();
    }
  };

  if (!hydrated) {
    return (
      <div className="flex flex-col flex-1 min-h-dvh bg-[var(--color-felt-dark)]">
        <BoardSkeleton />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-dvh"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Header
        onOpenStats={() => setStatsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <Board />
        <DragOverlay>
          {activeDrag && activeDrag.cards.length > 0 && (
            <div className="drag-stack">
              {activeDrag.cards.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    top: `calc(var(--fan-down) * ${i})`,
                  }}
                >
                  <Card suit={c.suit} rank={c.rank} />
                </div>
              ))}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <WinModal open={winOpen} onClose={() => setWinOpen(false)} />
    </div>
  );
}
