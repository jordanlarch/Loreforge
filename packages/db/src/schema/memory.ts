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
