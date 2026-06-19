import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev project config.
 * `project` ref comes from the Trigger.dev dashboard (Project settings → "proj_…").
 * Tasks live in ./src/trigger and run on Trigger.dev infrastructure (not Vercel),
 * so long-running generation cascades are not bound by serverless timeouts.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  dirs: ["./src/trigger"],
});
