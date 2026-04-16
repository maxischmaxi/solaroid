import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Glob above already picks up tests/persistence/*.test.ts — listed here
    // to document the three test families: game, canvas, persistence.
    globals: false,
  },
});
