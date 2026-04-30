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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{
        // Honour iOS notches / Android nav-bars so the modal never sits under
        // the system UI.
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="absolute inset-0 bg-[var(--color-modal-backdrop)]"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl sm:rounded-lg bg-[var(--color-modal-bg)] text-[var(--color-modal-text)] shadow-2xl ring-1 ring-black/20 max-h-[calc(100dvh-1.5rem)] sm:max-h-[85dvh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-modal-border)] shrink-0">
          <h2 className="font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center min-h-10 min-w-10 -mr-1 rounded text-[var(--color-modal-close)] hover:text-[var(--color-modal-close-hover)]"
            aria-label="Schließen"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
