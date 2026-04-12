"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-[var(--color-modal-backdrop)]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-[var(--color-modal-bg)] text-[var(--color-modal-text)] shadow-2xl ring-1 ring-black/20">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-modal-border)]">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-0.5 text-[var(--color-modal-close)] hover:text-[var(--color-modal-close-hover)]"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
