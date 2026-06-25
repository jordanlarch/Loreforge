import { logger, task } from "@trigger.dev/sdk/v3";

import { getDb, realmEntities } from "@app/db";

import type { RealmEntityType } from "@/lib/realms";
import {
  generateNewEntity,
  logGeneration,
  persistChildren,
} from "@/server/realms/generator";
import { wireCascadeNpcLocations } from "@/server/realms/cascade-wiring";
import { parseData } from "@/server/realms/schemas";

export type GenerateCascadePayload = {
  ownerId: string;
  type: RealmEntityType;
  concept: string;
  hints?: { species?: string; role?: string; level?: number };
  seed?: Record<string, string | number>;
};

export type GenerateCascadeResult = {
  entityId: string;
  childCount: number;
};

/**
 * Durable cascade generation (Realms generator pipeline, D3).
 *
 * Runs on Trigger.dev infrastructure, free of Vercel's serverless timeout — the
 * home for deep/multi-step cascades. The v1 thin-schema cascade is a single LLM
 * call with deterministic cheap stubs (D6), so the synchronous `realms.generate`
 * path also handles it; this task is the durable route reused as child
 * generators chain. Requires `ANTHROPIC_API_KEY` (+ `DATABASE_URL`) in the
 * Trigger.dev environment.
 */
export const generateCascade = task({
  id: "generate-cascade",
  maxDuration: 300,
  run: async (payload: GenerateCascadePayload): Promise<GenerateCascadeResult> => {
    const db = getDb();
    try {
      const { data: envelope, usage, model } = await generateNewEntity({
        db,
        type: payload.type,
        concept: payload.concept,
        hints: payload.hints,
        seed: payload.seed,
        ownerId: payload.ownerId,
      });
      const merged = payload.seed
        ? { ...envelope.data, ...payload.seed }
        : envelope.data;
      const data = parseData(payload.type, merged);
      const [row] = await db
        .insert(realmEntities)
        .values({
          ownerId: payload.ownerId,
          type: payload.type,
          name: envelope.name,
          summary: envelope.summary,
          isStub: false,
          data,
        })
        .returning();
      if (!row) throw new Error("Failed to insert generated entity.");

      const childCount = envelope.children?.length
        ? await persistChildren(db, payload.ownerId, row.id, envelope.children)
        : 0;

      if (childCount > 0) {
        await wireCascadeNpcLocations(db, payload.ownerId, row.id);
      }

      await logGeneration(db, {
        ownerId: payload.ownerId,
        entityId: row.id,
        entityType: payload.type,
        mode: "cascade",
        status: "success",
        model,
        usage,
      });
      logger.info("Cascade generation complete", {
        entityId: row.id,
        childCount,
      });
      return { entityId: row.id, childCount };
    } catch (err) {
      await logGeneration(db, {
        ownerId: payload.ownerId,
        entityId: null,
        entityType: payload.type,
        mode: "cascade",
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});
