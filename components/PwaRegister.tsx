"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once on mount. Renders nothing.
 * Dev-mode skips registration because Next.js HMR and an active SW can
 * serve stale chunks and cause hard-to-diagnose "why did my edit not
 * take effect" moments.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          // Registration failures are non-fatal; the app works online
          // either way, and we don't want to bother the user about them.
        });
    };

    // Wait for idle so the first paint isn't competing with the SW boot.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(register);
    } else {
      window.setTimeout(register, 2000);
    }
  }, []);

  return null;
}
