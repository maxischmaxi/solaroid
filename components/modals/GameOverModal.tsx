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
      <div className="space-y-3 text-center">
        <p className="text-3xl">😕</p>
        <p className="text-[var(--color-modal-subtext)]">
          Es gibt keine Züge mehr. Das Spiel ist vorbei.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              newGame();
              onClose();
            }}
            className="w-full rounded bg-[var(--color-btn-primary)] hover:bg-[var(--color-btn-primary-hover)] text-white font-medium py-2"
          >
            Neues Spiel
          </button>
          {canUndo && (
            <button
              onClick={() => {
                undo();
                onClose();
              }}
              className="w-full rounded bg-[var(--color-btn-secondary)] hover:bg-[var(--color-btn-secondary-hover)] text-white font-medium py-2"
            >
              Letzten Zug zurücknehmen
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded bg-[var(--color-btn-modal-secondary-bg)] hover:bg-[var(--color-btn-modal-secondary-hover)] text-[var(--color-btn-modal-secondary-text)] font-medium py-2"
          >
            Schließen
          </button>
        </div>
      </div>
    </Modal>
  );
}
