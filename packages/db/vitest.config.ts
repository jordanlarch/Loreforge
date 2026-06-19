import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // @app/engine is a workspace package symlinked into node_modules and ships
    // TS source (its export maps to src/index.ts), so it must be transformed
    // rather than externalized.
    server: { deps: { inline: ["@app/engine"] } },
  },
});
