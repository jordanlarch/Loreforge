/**
 * Live-turn RAG retrieval (#139, MEM-5) — the first live-play consumer of the
 * `@app/memory` `retrieveSimilar` seam.
 *
 * Given a player's line, fetch the campaign owner's most-similar Realms lore so
 * the AI-GM narration can stay consistent with the established world instead of
 * only the live scene + recent chat. Best-effort and env-gated on
 * `OPENAI_API_KEY`: with no key (dev/tests) it no-ops to `[]`, and any
 * DB/provider failure is swallowed — retrieval enrichment must never break a
 * live turn. The deterministic engine still owns all mechanics; this only
 * grounds the prose (`docs/data-sources.md` §6, `docs/deferrals.md` §6 MEM-5).
 */
import { getDb } from "@app/db";
import {
  REALM_ENTITY_SOURCE,
  resolveEmbeddingClient,
  retrieveSimilar,
  type RetrievedChunk,
} from "@app/memory";

import { getCampaignOwnerId } from "./db.js";

/** Default top-k retrieved chunks injected into a narration prompt. */
const DEFAULT_K = 4;

/**
 * Minimum cosine similarity for a chunk to be injected. Retrieval always
 * returns the top-k by similarity, but with a small corpus the tail can be
 * unrelated lore — gating on a modest floor keeps obvious noise out of the GM
 * prompt. Tuned conservatively; the rerank in the full assembler supersedes it.
 */
const MIN_SCORE = 0.2;

/** Whether live-turn world-knowledge retrieval is configured (embeddings on). */
export function isWorldKnowledgeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Seams for {@link retrieveWorldKnowledge} (real DB + memory tier by default). */
export type WorldKnowledgeDeps = {
  resolveOwnerId: (campaignId: string) => Promise<string | null>;
  retrieve: (
    ownerId: string,
    queryText: string,
    k: number,
  ) => Promise<RetrievedChunk[]>;
};

function defaultDeps(): WorldKnowledgeDeps {
  return {
    resolveOwnerId: getCampaignOwnerId,
    retrieve: (ownerId, queryText, k) =>
      retrieveSimilar(getDb(), resolveEmbeddingClient(), {
        ownerId,
        sourceTypes: [REALM_ENTITY_SOURCE],
        queryText,
        k,
      }),
  };
}

export type RetrieveWorldKnowledgeArgs = {
  campaignId: string;
  queryText: string;
  k?: number;
  minScore?: number;
};

/**
 * Owner-scoped Realms lore most similar to `queryText`, as plain chunk strings
 * ready to drop into a narration prompt. Returns `[]` (never throws) when:
 * embeddings are unconfigured, the query is blank, the campaign has no owner, or
 * anything fails. `deps` is injectable for tests; production uses the real DB +
 * memory tier.
 */
export async function retrieveWorldKnowledge(
  args: RetrieveWorldKnowledgeArgs,
  deps: WorldKnowledgeDeps = defaultDeps(),
): Promise<string[]> {
  if (!isWorldKnowledgeConfigured()) return [];
  const query = args.queryText.trim();
  if (!query) return [];

  try {
    const ownerId = await deps.resolveOwnerId(args.campaignId);
    if (!ownerId) return [];

    const hits = await deps.retrieve(ownerId, query, args.k ?? DEFAULT_K);
    const min = args.minScore ?? MIN_SCORE;
    return hits.filter((h) => h.score >= min).map((h) => h.chunkText);
  } catch {
    // Best-effort: a retrieval failure must never break the live turn.
    return [];
  }
}
