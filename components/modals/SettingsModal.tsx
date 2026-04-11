"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const drawMode = useGameStore((s) => s.settings.drawMode);
  const autoCompleteEnabled = useGameStore(
    (s) => s.settings.autoCompleteEnabled,
  );
  const updateSettings = useGameStore((s) => s.updateSettings);
  const newGame = useGameStore((s) => s.newGame);

  return (
    <Modal open={open} onClose={onClose} title="Einstellungen">
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-medium mb-2">Ziehen vom Stock</div>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded px-3 py-2 font-medium ${drawMode === 1 ? "bg-emerald-700 text-white" : "bg-zinc-200"}`}
              onClick={() => {
                updateSettings({ drawMode: 1 });
                newGame({ drawMode: 1 });
                onClose();
              }}
            >
              Draw 1
            </button>
            <button
              className={`flex-1 rounded px-3 py-2 font-medium ${drawMode === 3 ? "bg-emerald-700 text-white" : "bg-zinc-200"}`}
              onClick={() => {
                updateSettings({ drawMode: 3 });
                newGame({ drawMode: 3 });
                onClose();
              }}
            >
              Draw 3
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Wechseln startet ein neues Spiel.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Auto-Complete</div>
            <p className="text-xs text-zinc-500">
              Automatisch starten, wenn das Spiel gewinnbar ist
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ autoCompleteEnabled: !autoCompleteEnabled })
            }
            className={`rounded-full w-11 h-6 transition-colors ${autoCompleteEnabled ? "bg-emerald-600" : "bg-zinc-400"}`}
            aria-pressed={autoCompleteEnabled}
            aria-label="Auto-Complete umschalten"
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${autoCompleteEnabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}
