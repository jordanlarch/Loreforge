import {
  closeDb,
  getDb,
  ingestOpen5eBackgrounds,
  ingestOpen5eCreatures,
  ingestOpen5eFeats,
  ingestOpen5eItems,
  ingestOpen5eRules,
  ingestOpen5eSpells,
  seedCharacterOptions,
} from "@app/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Nightly Codex refresh.
 *
 * Runs on Trigger.dev infrastructure (not Vercel), so it is free of serverless
 * timeouts. Re-ingests Open5e SRD 5.2 corpora (spells, creatures, items,
 * backgrounds, feats, rules) and re-seeds curated species/classes. Does **not**
 * ingest legacy Open5e advanced rules (SRD-AUDIT-10 — use hand-seeded toolbox).
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

      const rules = await ingestOpen5eRules({
        db,
        logger: (message) => logger.info(message),
      });
      logger.info("Nightly Open5e rules ingest complete", { ...rules });

      const options = await seedCharacterOptions(db);
      logger.info("Nightly SRD character-options seed complete", { ...options });

      return {
        ...result,
        ...creatures,
        ...items,
        ...backgrounds,
        ...feats,
        ...rules,
        ...options,
      };
    } finally {
      await closeDb();
    }
  },
});
