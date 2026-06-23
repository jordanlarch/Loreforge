import { logger, schedules } from "@trigger.dev/sdk/v3";

import { closeDb, getDb } from "@app/db";
import { reembedRealmEntities, resolveEmbeddingClient } from "@app/memory";

import { isEmbeddingConfigured } from "@/server/memory/embed";

/**
 * Nightly drift re-embed (MEM-7, #147).
 *
 * Re-embeds every non-stub Realms entity via the shared, contentHash-gated
 * `reembedRealmEntities` pass, so any entity whose composed card drifted (edited
 * since it was last embedded) or that was never embedded (e.g. written while the
 * provider was down) is brought back in sync. Idempotent — unchanged entities
 * are no-ops, so a missed/extra run is harmless.
 *
 * A *scheduled* task (like the Open5e ingest): it runs on Trigger.dev infra and
 * needs no runtime trigger key — only `OPENAI_API_KEY` + `DATABASE_URL` in the
 * Trigger.dev environment. No-ops (logs + returns) when embedding is unconfigured
 * rather than writing fake vectors.
 *
 * Schedule: 09:00 UTC daily (after the 08:00 Codex ingest).
 */
export const reembedEntitiesNightly = schedules.task({
  id: "reembed-entities",
  cron: "0 9 * * *",
  maxDuration: 900,
  run: async (payload) => {
    if (!isEmbeddingConfigured()) {
      logger.warn("Embedding not configured; skipping nightly re-embed");
      return { ran: false as const };
    }

    logger.info("Starting nightly Realms re-embed", {
      scheduledAt: payload.timestamp,
      lastRun: payload.lastTimestamp ?? null,
    });

    const db = getDb();
    try {
      const client = resolveEmbeddingClient();
      const result = await reembedRealmEntities(db, client, {
        onError: (id, error) =>
          logger.warn("Re-embed failed for entity", {
            entityId: id,
            error: error instanceof Error ? error.message : String(error),
          }),
      });
      logger.info("Nightly Realms re-embed complete", { ...result });
      return { ran: true as const, ...result };
    } finally {
      await closeDb();
    }
  },
});
