import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Workspace packages ship TS source (their exports map to src/index.ts), so
    // they must be transformed by vitest rather than externalized.
    server: { deps: { inline: ["@app/db", "@app/engine", "@app/config"] } },
  },
});
