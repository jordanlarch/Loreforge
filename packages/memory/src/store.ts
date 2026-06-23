import { and, asc, cosineDistance, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

import { embeddings } from "@app/db";

import {
  buildEntityEmbeddingInput,
  type EmbeddableRealmEntity,
  type EmbeddingChunk,
} from "./chunk";
import type { EmbeddingClient } from "./client";

// Driver-agnostic Drizzle handle (postgres-js in prod, PGlite in tests) —
// matches the `PgEventStore` convention in `@app/db`.
type AnyPgDatabase = PgDatabase<any, any, any>;

/** `sourceType` discriminator for embedded Realms entities. */
export const REALM_ENTITY_SOURCE = "realm_entity" as const;

/** `sourceType` discriminator for embedded session recaps (MEM-4). */
export const SESSION_RECAP_SOURCE = "session_recap" as const;

export type UpsertSourceEmbeddingsParams = {
  ownerId: string;
  /** Null for owner-scoped sources (Realms entities) not yet campaign-linked. */
  campaignId?: string | null;
  sourceType: string;
  sourceId: string;
  /** Ordered chunks for this source (single "card" chunk → one entry). */
  chunks: EmbeddingChunk[];
};

export type UpsertSourceEmbeddingsResult = {
  /** `unchanged` → contentHash matched; no embedding call was made. */
  status: "embedded" | "unchanged";
  /** Number of chunks (re-)embedded and written. */
  embedded: number;
  /** Model the embeddings were produced with ("" when nothing was embedded). */
  model: string;
  /** Total embedding tokens billed (0 when nothing was embedded). */
  tokens: number;
};

/**
 * Upsert all embeddings for a single source (delete-then-insert by
 * `(sourceType, sourceId)`), gated on `contentHash`: if the stored chunk hashes
 * already match the incoming ones exactly, nothing is embedded or written.
 * Otherwise the source's rows are replaced with freshly embedded chunks.
 */
export async function upsertSourceEmbeddings(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  params: UpsertSourceEmbeddingsParams,
): Promise<UpsertSourceEmbeddingsResult> {
  const { ownerId, campaignId = null, sourceType, sourceId, chunks } = params;
  const sourceMatch = and(
    eq(embeddings.sourceType, sourceType),
    eq(embeddings.sourceId, sourceId),
  );

  const existing = await db
    .select({
      chunkIndex: embeddings.chunkIndex,
      contentHash: embeddings.contentHash,
    })
    .from(embeddings)
    .where(sourceMatch)
    .orderBy(asc(embeddings.chunkIndex));

  const unchanged =
    chunks.length > 0 &&
    existing.length === chunks.length &&
    chunks.every((c, i) => existing[i]?.contentHash === c.contentHash);
  if (unchanged) return { status: "unchanged", embedded: 0, model: "", tokens: 0 };

  if (chunks.length === 0) {
    if (existing.length > 0) await db.delete(embeddings).where(sourceMatch);
    return { status: "embedded", embedded: 0, model: "", tokens: 0 };
  }

  const { vectors, model, usage } = await client.embed(
    chunks.map((c) => c.chunkText),
  );
  await db.delete(embeddings).where(sourceMatch);
  await db.insert(embeddings).values(
    chunks.map((c, i) => ({
      ownerId,
      campaignId,
      sourceType,
      sourceId,
      chunkIndex: i,
      chunkText: c.chunkText,
      embedding: vectors[i] ?? [],
      model,
      contentHash: c.contentHash,
    })),
  );

  return {
    status: "embedded",
    embedded: chunks.length,
    model,
    tokens: usage.totalTokens,
  };
}

/** Result of an entity embed: `skipped` when the entity is a stub. */
export type EmbedRealmEntityResult =
  | { status: "skipped" }
  | UpsertSourceEmbeddingsResult;

/**
 * Compose a Realms entity's "card" chunk and upsert it (owner-scoped, no
 * campaign). Returns `{ status: "skipped" }` for stubs (no content to embed).
 * Throws on real failures — see {@link embedRealmEntityBestEffort} for the
 * write-path-safe variant.
 */
export async function embedRealmEntity(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  entity: EmbeddableRealmEntity,
): Promise<EmbedRealmEntityResult> {
  const chunk = buildEntityEmbeddingInput(entity);
  if (!chunk) return { status: "skipped" };
  return upsertSourceEmbeddings(db, client, {
    ownerId: entity.ownerId,
    sourceType: REALM_ENTITY_SOURCE,
    sourceId: entity.id,
    chunks: [chunk],
  });
}

export type EmbedRealmEntityBestEffortOptions = {
  /** Called once with the result on success (e.g. for structured cost logs). */
  onResult?: (result: EmbedRealmEntityResult) => void;
  /** Called if embedding throws; the error is otherwise swallowed. */
  onError?: (error: unknown) => void;
};

/**
 * Write-path-safe {@link embedRealmEntity}: never throws, so a provider/network
 * failure can't fail the originating mutation. Returns the result on success or
 * `null` on failure. Embedding is a best-effort enrichment — a missed embed is
 * recoverable later (backfill / re-embed), so it must not break the write.
 */
export async function embedRealmEntityBestEffort(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  entity: EmbeddableRealmEntity,
  options: EmbedRealmEntityBestEffortOptions = {},
): Promise<EmbedRealmEntityResult | null> {
  try {
    const result = await embedRealmEntity(db, client, entity);
    options.onResult?.(result);
    return result;
  } catch (error) {
    options.onError?.(error);
    return null;
  }
}

export type RetrieveSimilarOptions = {
  ownerId: string;
  /** When set, restrict to embeddings linked to this campaign. */
  campaignId?: string | null;
  /** When set, restrict to these source discriminators. */
  sourceTypes?: string[];
  queryText: string;
  /** Max results (top-k). */
  k?: number;
};

export type RetrievedChunk = {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  /** Cosine similarity in [-1, 1]; ~1.0 for an exact text match. */
  score: number;
};

/**
 * Embed `queryText` and return the top-k most cosine-similar chunks, filtered by
 * owner (and optionally campaign / source types). This is the single retrieval
 * primitive; a multi-category rerank (recency / pinning / cross-link) layers on
 * top of it once those source types exist (see `docs/deferrals.md` §6 MEM-5).
 */
export async function retrieveSimilar(
  db: AnyPgDatabase,
  client: EmbeddingClient,
  options: RetrieveSimilarOptions,
): Promise<RetrievedChunk[]> {
  const { ownerId, campaignId, sourceTypes, queryText, k = 8 } = options;

  const { vectors } = await client.embed([queryText]);
  const queryVec = vectors[0];
  if (!queryVec) return [];

  const distance = cosineDistance(embeddings.embedding, queryVec);
  const score = sql<number>`1 - (${distance})`;

  const filters = [eq(embeddings.ownerId, ownerId)];
  if (campaignId != null) filters.push(eq(embeddings.campaignId, campaignId));
  if (sourceTypes && sourceTypes.length > 0) {
    filters.push(inArray(embeddings.sourceType, sourceTypes));
  }

  const rows = await db
    .select({
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      chunkIndex: embeddings.chunkIndex,
      chunkText: embeddings.chunkText,
      score,
    })
    .from(embeddings)
    .where(and(...filters))
    // Ascending cosine distance == descending similarity (most similar first).
    .orderBy(distance)
    .limit(k);

  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    chunkIndex: r.chunkIndex,
    chunkText: r.chunkText,
    score: Number(r.score),
  }));
}
