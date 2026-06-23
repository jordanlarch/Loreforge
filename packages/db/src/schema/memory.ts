import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Embedding dimensionality for OpenAI `text-embedding-3-small` (and the
 * deterministic fake). Kept here so the schema, the embedding client, and the
 * harness agree on a single source of truth.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Polymorphic embeddings store — the pgvector home for the memory tier (P5,
 * MEM-1; `docs/data-sources.md` §6, `docs/deferrals.md` §6).
 *
 * One row per (source, chunk): every embeddable thing (Realms entities first;
 * later session recaps, pinned memories, plot hooks, journal entries) is chunked
 * and embedded into this single table rather than a per-table `embedding`
 * column. This supports multi-chunk-per-source, a uniform cosine retrieval query
 * across heterogeneous `sourceType`s, and new source types without a per-table
 * migration. Owner-scoped (no FK, app-scoped, matching the rest of the schema);
 * `campaignId` is nullable because owner-scoped sources (Realms entities) have
 * no campaign until linked.
 *
 * `contentHash` is the hash of the composed chunk text; it gates skip-if-
 * unchanged on re-embed. The HNSW index uses cosine distance (`<=>`).
 */
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    /** Null until the source is scoped to a campaign. */
    campaignId: uuid("campaign_id"),
    /** Discriminator for the embedded source (e.g. "realm_entity"). */
    sourceType: text("source_type").notNull(),
    /** The source row's id. */
    sourceId: uuid("source_id").notNull(),
    /** 0-based chunk ordinal within the source (single "card" chunk → 0). */
    chunkIndex: integer("chunk_index").notNull().default(0),
    /** The exact text that was embedded (kept for retrieval payloads + debug). */
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    /** Resolved embedding model id the provider actually ran. */
    model: text("model").notNull().default(""),
    /** Hash of the composed chunk text; gates skip-if-unchanged re-embed. */
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Cosine-distance HNSW index for `retrieveSimilar` (`embedding <=> query`).
    index("embeddings_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    index("embeddings_owner_idx").on(t.ownerId),
    index("embeddings_campaign_idx").on(t.campaignId),
    // Re-embed / delete by source, and the natural key for delete-then-insert.
    uniqueIndex("embeddings_source_chunk_unique").on(
      t.sourceType,
      t.sourceId,
      t.chunkIndex,
    ),
  ],
);

/**
 * Rolling session summary — the memory tier's working-memory layer (P5, MEM-3;
 * `docs/data-sources.md` §6 tier 3).
 *
 * A single, periodically-regenerated condensed summary of the *current* live
 * session per campaign, injected into the AI-GM narration prompt alongside the
 * engine state, hot chat, and RAG retrieval. The WS server (the authoritative
 * live host) regenerates it inline, best-effort, every N turns and upserts the
 * one row keyed by `campaignId`. `coveredSeq` records the chat length the summary
 * already covers, so the cadence only regenerates after enough new turns.
 *
 * Deliberately campaign-scoped (no `ownerId`): it is only ever read/written by
 * the live host by `campaignId`, never owner-scoped-queried. It is transient
 * working memory — NOT an embedded RAG source (finalized, embeddable session
 * recap documents are the separate sessions concept, MEM-4).
 */
export const rollingSummaries = pgTable(
  "rolling_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    /** The condensed running summary text (~500 tokens). */
    summary: text("summary").notNull().default(""),
    /** Chat length (entry count) the current summary already covers. */
    coveredSeq: integer("covered_seq").notNull().default(0),
    /** Resolved model id that produced the summary ("" before first run). */
    model: text("model").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("rolling_summaries_campaign_unique").on(t.campaignId)],
);
