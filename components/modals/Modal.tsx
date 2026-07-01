"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Tailwind max-width class. Defaults to `max-w-sm`; larger modals (e.g.
   *  StatsModal with charts) can pass `max-w-md` / `max-w-lg`. */
  maxWidthClass?: string;
  children: ReactNode;
}

const EXIT_MS = 170;

export function Modal({
  open,
  onClose,
  title,
  maxWidthClass = "max-w-sm",
  children,
}: ModalProps) {
  const titleId = useId();
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      if (rendered) return;
      const id = window.setTimeout(() => setRendered(true), 0);
      return () => window.clearTimeout(id);
    }
    if (!rendered) return;

    const id = window.setTimeout(() => setRendered(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  if (!open && !rendered) return null;

  const state = open ? "open" : "closing";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
      style={{
        // Honour iOS notches / Android nav-bars so the modal never sits under
        // the system UI.
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
    >
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0 cursor-default"
        data-state={state}
        onClick={onClose}
        aria-label="Dialog schließen"
        tabIndex={-1}
      />
      <div
        className={`ui-modal-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full ${maxWidthClass} flex-col overflow-hidden text-[var(--color-modal-text)] sm:max-h-[85dvh]`}
        data-state={state}
      >
        <div className="ui-modal-header flex shrink-0 items-center justify-between px-5 py-4">
          <h2 id={titleId} className="ui-modal-title text-lg tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-control ui-control-quiet ui-modal-close -mr-2 h-9 min-w-9 rounded-md p-0"
            aria-label="Schließen"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
