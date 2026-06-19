import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev project config.
 * `project` ref comes from the Trigger.dev dashboard (Project settings → "proj_…").
 * It is not a secret, so it is hardcoded as the default; `TRIGGER_PROJECT_REF`
 * can still override it (e.g. for a separate project). Hardcoding lets
 * `trigger deploy` work without the env being loaded (the deploy script is not
 * dotenv-wrapped).
 * Tasks live in ./src/trigger and run on Trigger.dev infrastructure (not Vercel),
 * so long-running generation cascades are not bound by serverless timeouts.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_pywyqcovveavdmoqpzsg",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  dirs: ["./src/trigger"],
});
