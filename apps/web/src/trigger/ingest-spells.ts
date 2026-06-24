import {
  closeDb,
  getDb,
  ingestOpen5eBackgrounds,
  ingestOpen5eCreatures,
  ingestOpen5eFeats,
  ingestOpen5eItems,
  ingestOpen5eSpells,
  seedCharacterOptions,
} from "@app/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Nightly Codex refresh.
 *
 * Runs on Trigger.dev infrastructure (not Vercel), so it is free of serverless
 * timeouts. Re-ingests the full SRD 5.1 spell list into `codex_spells` via the
 * shared `ingestOpen5eSpells()` lib, then re-seeds the curated SRD species +
 * classes into `codex_species` / `codex_classes` via `seedCharacterOptions()`
 * (the Creation Wizard's data source, #6). Both share the same code paths as the
 * `npm run ingest:open5e` / `npm run seed:character-options` CLIs, so they never
 * drift.
 *
 * Schedule: 08:00 UTC daily (~overnight in the Americas). Idempotent: upserts by
 * slug, so a missed/extra run is harmless.
 *
 * Requires `DATABASE_URL` to be set in the Trigger.dev environment (Dashboard →
 * Environment Variables), plus a configured Trigger.dev project
 * (`TRIGGER_PROJECT_REF`) to deploy.
 *
 * @see packages/db/src/ingest/open5e-spells.ts
 * @see packages/db/src/ingest/srd-character-options.ts
 * @see docs/data-sources.md §1
 */
export const ingestSpellsNightly = schedules.task({
  id: "ingest-open5e-spells",
  cron: "0 8 * * *",
  maxDuration: 600,
  run: async (payload) => {
    logger.info("Starting nightly Codex refresh", {
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

      const creatures = await ingestOpen5eCreatures({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e creature ingest complete", { ...creatures });

      const items = await ingestOpen5eItems({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e item ingest complete", { ...items });

      const backgrounds = await ingestOpen5eBackgrounds({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e background ingest complete", { ...backgrounds });

      const feats = await ingestOpen5eFeats({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e feat ingest complete", { ...feats });

      const options = await seedCharacterOptions(db);
      logger.info("Nightly SRD character-options seed complete", { ...options });

      return { ...result, ...creatures, ...items, ...backgrounds, ...feats, ...options };
    } finally {
      await closeDb();
    }
  },
});
