import { closeDb, getDb, ingestOpen5eSpells } from "@app/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Nightly Open5e SRD spell ingest.
 *
 * Runs on Trigger.dev infrastructure (not Vercel), so it is free of serverless
 * timeouts. Re-ingests the full SRD 5.1 spell list and upserts into
 * `codex_spells` via the shared `ingestOpen5eSpells()` lib — the same code path
 * as the manual `npm run ingest:open5e` CLI, so the two never drift.
 *
 * Schedule: 08:00 UTC daily (~overnight in the Americas). Idempotent: upserts by
 * slug, so a missed/extra run is harmless.
 *
 * Requires `DATABASE_URL` to be set in the Trigger.dev environment (Dashboard →
 * Environment Variables), plus a configured Trigger.dev project
 * (`TRIGGER_PROJECT_REF`) to deploy.
 *
 * @see packages/db/src/ingest/open5e-spells.ts
 * @see docs/data-sources.md §1
 */
export const ingestSpellsNightly = schedules.task({
  id: "ingest-open5e-spells",
  cron: "0 8 * * *",
  maxDuration: 600,
  run: async (payload) => {
    logger.info("Starting nightly Open5e spell ingest", {
      scheduledAt: payload.timestamp,
      lastRun: payload.lastTimestamp ?? null,
    });

    const db = getDb();
    try {
      const result = await ingestOpen5eSpells({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e spell ingest complete", { ...result });
      return result;
    } finally {
      await closeDb();
    }
  },
});
