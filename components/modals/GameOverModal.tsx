"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GameOverModal({ open, onClose }: Props) {
  const newGame = useGameStore((s) => s.newGame);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const undo = useGameStore((s) => s.undo);

  return (
    <Modal open={open} onClose={onClose} title="Spiel vorbei">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-3xl ring-1 ring-rose-500/20">
          😕
        </div>
        <h3 className="text-xl font-semibold tracking-tight">
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
