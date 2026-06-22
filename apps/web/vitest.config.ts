import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Web unit-test config. The `vite-tsconfig-paths` plugin teaches Vitest the
 * `@/*` → `./src/*` alias from tsconfig, so tests (and the modules they import)
 * can use the same `@/…` paths as the app instead of brittle relative climbs.
 *
 * `@app/*` workspace packages ship TS source (their export maps point at
 * `src/index.ts`), so they're inlined for transform rather than externalized.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    server: { deps: { inline: [/^@app\//] } },
  },
});
