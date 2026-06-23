/**
 * Generator RAG grounding (#141, MEM-6 / GEN-4) — retrieve the owner's existing
 * world entities most similar to what's being generated, so new/expanded/
 * regenerated content references and stays consistent with established lore
 * instead of inventing a disconnected world each run.
 *
 * The first non-debug consumer of the `@app/memory` `retrieveSimilar` seam. Like
 * the write-path embed glue it is **best-effort** and env-gated on
 * `OPENAI_API_KEY`: with no real provider (dev/tests) it returns `[]` and the
 * generator prompt is unchanged, so existing generator behavior/tests are
 * untouched. Any retrieval failure is swallowed — grounding must never break a
 * generation request (`docs/deferrals.md` §6 MEM-6 / D11, `docs/data-sources.md` §6).
 */
import type { Database } from "@app/db";
import {
  REALM_ENTITY_SOURCE,
  resolveEmbeddingClient,
  retrieveSimilar,
  type EmbeddingClient,
} from "@app/memory";

import { isEmbeddingConfigured } from "./embed";

/** Default top-k existing entities injected as grounding context. */
const DEFAULT_K = 5;

/**
 * Minimum cosine similarity for a neighbor to be injected. Retrieval returns the
 * top-k by similarity, but with a small corpus the tail can be unrelated — a
 * modest floor keeps obvious noise out of the generation prompt.
 */
const MIN_SCORE = 0.2;

export type LoadRelatedLoreOptions = {
  ownerId: string;
  queryText: string;
  /** Exclude this source id from results (the entity being expanded/regenerated). */
  excludeEntityId?: string;
  k?: number;
  /** Injected client (tests). When omitted, resolved from the environment. */
  client?: EmbeddingClient;
};

/**
 * The owner's existing Realms entities most similar to `queryText`, as plain
 * chunk strings ready to drop into a generation prompt. Returns `[]` (never
 * throws) when: embeddings are unconfigured and no client is injected, the query
 * is blank, or anything fails.
 */
export async function loadRelatedLore(
  db: Database,
  options: LoadRelatedLoreOptions,
): Promise<string[]> {
  const client =
    options.client ?? (isEmbeddingConfigured() ? resolveEmbeddingClient() : null);
  if (!client) return [];
  const query = options.queryText.trim();
  if (!query) return [];

  const k = options.k ?? DEFAULT_K;
  try {
    const hits = await retrieveSimilar(db, client, {
      ownerId: options.ownerId,
      sourceTypes: [REALM_ENTITY_SOURCE],
      queryText: query,
      // Over-fetch by one so excluding self still yields k neighbors.
      k: options.excludeEntityId ? k + 1 : k,
    });
    return hits
      .filter(
        (h) => h.sourceId !== options.excludeEntityId && h.score >= MIN_SCORE,
      )
      .slice(0, k)
      .map((h) => h.chunkText);
  } catch {
    // Best-effort: a retrieval failure must never break generation.
    return [];
  }
}
