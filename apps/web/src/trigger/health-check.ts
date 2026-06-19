import { task } from "@trigger.dev/sdk/v3";

/**
 * P0 placeholder task — nightly Open5e ingest lands in P1.
 * Trigger from server code: `await healthCheck.trigger({ name: "manual" })`.
 */
export const healthCheck = task({
  id: "health-check",
  run: async (payload: { name?: string }) => {
    return {
      received: payload.name ?? null,
      at: new Date().toISOString(),
    };
  },
});
