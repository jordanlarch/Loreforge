/**
 * @app/memory — the RAG / memory tier (P5, MEM-1).
 *
 * Owns the embedding-client seam (OpenAI + deterministic fake), card-chunk
 * composition, and the pgvector store + retrieval primitive. The pgvector
 * `embeddings` table itself lives in `@app/db` (all schema lives there); this
 * package is the typed access + provider layer over it.
 *
 * @see docs/data-sources.md §6 (embeddings & RAG)
 * @see docs/deferrals.md §6 (memory tier backlog)
 */
export {
  DEFAULT_EMBEDDING_MODEL,
  FAKE_EMBEDDING_MODEL,
  EmbeddingError,
  createOpenAIEmbeddingClient,
  createDeterministicEmbeddingClient,
  deterministicVector,
  resolveEmbeddingClient,
  type EmbeddingClient,
  type EmbedResult,
  type DeterministicEmbeddingClient,
  type OpenAIEmbeddingClientOptions,
  type ResolveEmbeddingClientOptions,
} from "./client";
export {
  composeEntityChunkText,
  buildEntityEmbeddingInput,
  composeCrossLinkText,
  buildCrossLinkEmbeddingInput,
  CROSS_LINK_VERBS,
  contentHash,
  type EmbeddableRealmEntity,
  type CrossLinkInput,
  type EmbeddingChunk,
} from "./chunk";
export {
  REALM_ENTITY_SOURCE,
  SESSION_RECAP_SOURCE,
  PINNED_MEMORY_SOURCE,
  CROSS_LINK_SOURCE,
  upsertSourceEmbeddings,
  deleteSourceEmbeddings,
  embedRealmEntity,
  embedRealmEntityBestEffort,
  embedCrossLink,
  embedCrossLinkBestEffort,
  retrieveSimilar,
  type UpsertSourceEmbeddingsParams,
  type UpsertSourceEmbeddingsResult,
  type EmbedRealmEntityResult,
  type EmbedRealmEntityBestEffortOptions,
  type EmbeddableCrossLink,
  type EmbedCrossLinkResult,
  type EmbedCrossLinkBestEffortOptions,
  type RetrieveSimilarOptions,
  type RetrievedChunk,
} from "./store";
export {
  reembedRealmEntities,
  reembedCrossLinks,
  type ReembedRealmEntitiesResult,
  type ReembedRealmEntitiesOptions,
  type ReembedCrossLinksResult,
  type ReembedCrossLinksOptions,
} from "./reembed";
