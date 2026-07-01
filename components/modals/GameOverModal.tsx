"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Two crossed, face-down cards — the hand is dead. */
function StuckCardsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true">
      <rect
        x="10"
        y="9"
        width="18"
        height="26"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        transform="rotate(-10 19 22)"
      />
      <rect
        x="21"
        y="12"
        width="18"
        height="26"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        transform="rotate(9 30 25)"
      />
    </svg>
  );
}

export function GameOverModal({ open, onClose }: Props) {
  const newGame = useGameStore((s) => s.newGame);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const undo = useGameStore((s) => s.undo);

  return (
    <Modal open={open} onClose={onClose} title="Spiel vorbei">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-carmine/10 text-carmine ring-1 ring-carmine/25">
          <StuckCardsIcon />
        </div>
        <h3 className="font-serif text-2xl font-semibold tracking-tight">
          Keine weiteren Züge
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-modal-subtext)]">
          Das Blatt ist festgefahren. Starte sauber neu oder gehe einen Schritt
          zurück und probiere eine andere Linie.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              newGame();
              onClose();
            }}
            className="ui-control ui-control-primary ui-control-full h-10"
          >
            Neues Spiel
          </button>
          {canUndo && (
            <button
              type="button"
              onClick={() => {
                undo();
                onClose();
              }}
              className="ui-control ui-control-modal-secondary ui-control-full h-10"
            >
              Letzten Zug zurücknehmen
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ui-control ui-control-modal-secondary ui-control-full h-10"
          >
            Schließen
          </button>
        </div>
      </div>
    </Modal>
  );
}
