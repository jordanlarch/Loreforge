import { logger, task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";

import { getDb, realmEntities } from "@app/db";
import {
  embedRealmEntityBestEffort,
  resolveEmbeddingClient,
} from "@app/memory";

import { isEmbeddingConfigured } from "@/server/memory/embed";

export type EmbedEntityPayload = { entityId: string };

export type EmbedEntityResult = { status: "embedded" | "unchanged" | "skipped" | "noop" };

/**
 * Durable write-path embedding for a single Realms entity (MEM-7, #147).
 *
 * `embedRealmEntityOnWrite` dispatches this when `TRIGGER_SECRET_KEY` is set, to
 * keep embedding off the originating mutation's request path; otherwise the
 * mutation embeds inline. The task reloads the entity (so it embeds the latest
 * committed state) and requires a real provider key in the Trigger.dev env —
 * without one it no-ops rather than writing fake vectors. Best-effort.
 */
export const embedEntity = task({
  id: "embed-entity",
  maxDuration: 120,
  run: async (payload: EmbedEntityPayload): Promise<EmbedEntityResult> => {
    if (!isEmbeddingConfigured()) {
      logger.warn("Embedding not configured in this environment; skipping", {
        entityId: payload.entityId,
      });
      return { status: "noop" };
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(realmEntities)
      .where(eq(realmEntities.id, payload.entityId))
      .limit(1);
    if (!row) {
      logger.warn("Entity not found; nothing to embed", {
        entityId: payload.entityId,
      });
      return { status: "noop" };
    }

    const client = resolveEmbeddingClient();
    const result = await embedRealmEntityBestEffort(db, client, {
      id: row.id,
      ownerId: row.ownerId,
      type: row.type,
      name: row.name,
      summary: row.summary,
      data: row.data,
      isStub: row.isStub,
    });
    const status = result?.status ?? "noop";
    logger.info("Entity embed complete", { entityId: row.id, status });
    return { status };
  },
});
