/**
 * Bulk re-embed pass for Realms entities (MEM-7; `docs/data-sources.md` §6).
 *
 * Walks every non-stub Realms entity and (re-)embeds its card chunk. Idempotent
 * and drift-correcting: `embedRealmEntity` is contentHash-gated, so an entity
 * whose composed text is unchanged is a no-op (`unchanged`), and only entities
 * that drifted (edited) or were never embedded actually call the provider. Shared
 * by the one-off `backfill:embeddings` script and the nightly `reembed-entities`
 * Trigger task so the two never diverge.
 */
import { eq } from "drizzle-orm";
import { alias, type PgDatabase } from "drizzle-orm/pg-core";

import { realmEntities, realmRelationships } from "@app/db";

import type { EmbeddingClient } from "./client";
import { embedCrossLink, embedRealmEntity } from "./store";

type AnyPgDatabase = PgDatabase<any, any, any>;

export type ReembedRealmEntitiesResult = {
  total: number;
  embedded: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

export type ReembedRealmEntitiesOptions = {
  /** Called per-entity on failure; the error is otherwise swallowed (best-effort). */
  onError?: (entityId: string, error: unknown) => void;
};

/**
 * Re-embed all non-stub Realms entities. Never throws on a single entity's
 * failure (counted in `failed`); the whole pass only rejects on the initial
 * query. Returns per-status counts.
 */
export async function reembedRealmEntities(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  options: ReembedRealmEntitiesOptions = {},
): Promise<ReembedRealmEntitiesResult> {
  const rows = await db
    .select()
    .from(realmEntities)
    .where(eq(realmEntities.isStub, false));

  let embedded = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await embedRealmEntity(db, client, {
        id: row.id,
        ownerId: row.ownerId,
        type: row.type,
        name: row.name,
        summary: row.summary,
        data: row.data,
        isStub: row.isStub,
      });
      if (result.status === "skipped") skipped++;
      else if (result.status === "unchanged") unchanged++;
      else embedded++;
    } catch (error) {
      failed++;
      options.onError?.(row.id, error);
    }
  }

  return { total: rows.length, embedded, unchanged, skipped, failed };
}

export type ReembedCrossLinksResult = {
  total: number;
  embedded: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

export type ReembedCrossLinksOptions = {
  /** Called per-edge on failure; the error is otherwise swallowed. */
  onError?: (relationshipId: string, error: unknown) => void;
};

/**
 * Re-embed every relationship edge as a `cross_link` chunk (GEN-5), joining each
 * edge to its two endpoints for the rendered sentence. ContentHash-gated and
 * idempotent like {@link reembedRealmEntities}, so this is the catch-all that
 * covers edges created by the cascade or before embed-on-link existed. Only the
 * initial query can reject; per-edge failures are counted in `failed`.
 */
export async function reembedCrossLinks(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  options: ReembedCrossLinksOptions = {},
): Promise<ReembedCrossLinksResult> {
  const fromE = alias(realmEntities, "cl_from");
  const toE = alias(realmEntities, "cl_to");
  const rows = await db
    .select({
      id: realmRelationships.id,
      ownerId: realmRelationships.ownerId,
      kind: realmRelationships.kind,
      fromName: fromE.name,
      fromType: fromE.type,
      toName: toE.name,
      toType: toE.type,
    })
    .from(realmRelationships)
    .innerJoin(fromE, eq(fromE.id, realmRelationships.fromId))
    .innerJoin(toE, eq(toE.id, realmRelationships.toId));

  let embedded = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await embedCrossLink(db, client, {
        id: row.id,
        ownerId: row.ownerId,
        kind: row.kind,
        fromName: row.fromName,
        fromType: row.fromType,
        toName: row.toName,
        toType: row.toType,
      });
      if (result.status === "skipped") skipped++;
      else if (result.status === "unchanged") unchanged++;
      else embedded++;
    } catch (error) {
      failed++;
      options.onError?.(row.id, error);
    }
  }

  return { total: rows.length, embedded, unchanged, skipped, failed };
}
