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
        <p className="text-zinc-700">
          Es gibt keine Züge mehr. Das Spiel ist vorbei.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              newGame();
              onClose();
            }}
            className="w-full rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium py-2"
          >
            Neues Spiel
          </button>
          {canUndo && (
            <button
              onClick={() => {
                undo();
                onClose();
              }}
              className="w-full rounded bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2"
            >
              Letzten Zug zurücknehmen
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium py-2"
          >
            Schließen
          </button>
        </div>
      </div>
    </Modal>
  );
}
