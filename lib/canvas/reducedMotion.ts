// Thin wrapper around prefers-reduced-motion. Kept as a function (not a
// constant) so SSR doesn't crash and so changes during a session take effect.

export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
