/**
 * Live-turn RAG retrieval + rerank (#139 MEM-5; `docs/data-sources.md` §6) — the
 * live-play consumer of the `@app/memory` `retrieveSimilar` seam.
 *
 * Given a player's line, assemble the most relevant grounding for the AI-GM from
 * two memory categories and rerank them into one top-k list:
 *   - **Lore** — the campaign owner's Realms entities (established world facts),
 *     owner-scoped.
 *   - **Recaps** — this campaign's past session recaps (what already happened),
 *     campaign-scoped, with a recency boost so recent sessions outrank old ones.
 *   - **Pinned memory** — durable DM-pinned facts (#155), campaign-scoped, with
 *     the highest category weight so they surface preferentially.
 *
 * The rolling session summary (MEM-3) is injected separately as the "story so
 * far" (current session); this layer covers durable lore + past sessions +
 * pins. Cross-link inference is a future source type that slots into the same
 * rerank. Best-effort and env-gated on `OPENAI_API_KEY`: no key (dev/tests) →
 * `[]`, and any failure is swallowed — retrieval enrichment must never break a
 * live turn. The deterministic engine still owns all mechanics; this only grounds
 * the prose.
 */
import { getDb } from "@app/db";
import {
  PINNED_MEMORY_SOURCE,
  REALM_ENTITY_SOURCE,
  SESSION_RECAP_SOURCE,
  resolveEmbeddingClient,
  retrieveSimilar,
  type RetrievedChunk,
} from "@app/memory";

import { getCampaignOwnerId } from "./db.js";

/** Default total chunks injected into a narration prompt (after rerank). */
const DEFAULT_K = 4;

/** Per-category fetch depth before the cross-category rerank trims to top-k. */
const PER_CATEGORY_K = 4;

/**
 * Minimum cosine similarity for a chunk to be eligible. Retrieval always returns
 * the top-k by similarity, but with a small corpus the tail can be unrelated —
 * gating on a modest floor keeps obvious noise out of the GM prompt. Applied to
 * the raw cosine score (before category weighting) so weighting can't sneak noise
 * past the floor.
 */
const MIN_SCORE = 0.2;

/**
 * Most a recap's recency can add to its adjusted score — a tiebreak, not a
 * dominator. The most-recent recap in the retrieved set gets the full bonus, the
 * oldest gets none, scaled linearly between.
 */
const RECENCY_WEIGHT = 0.05;

/** Whether live-turn world-knowledge retrieval is configured (embeddings on). */
export function isWorldKnowledgeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type RetrieveParams = {
  ownerId: string;
  /** Set for campaign-scoped categories (recaps); omitted for owner-scoped lore. */
  campaignId?: string | null;
  sourceTypes: string[];
  queryText: string;
  k: number;
};

/** Seams for {@link retrieveWorldKnowledge} (real DB + memory tier by default). */
export type WorldKnowledgeDeps = {
  resolveOwnerId: (campaignId: string) => Promise<string | null>;
  retrieve: (params: RetrieveParams) => Promise<RetrievedChunk[]>;
};

function defaultDeps(): WorldKnowledgeDeps {
  return {
    resolveOwnerId: getCampaignOwnerId,
    retrieve: (params) =>
      retrieveSimilar(getDb(), resolveEmbeddingClient(), params),
  };
}

/** A memory category contributing chunks to the reranked assembly. */
type Category = {
  /** Owner-scoped lore vs campaign-scoped recaps. */
  scope: "owner" | "campaign";
  sourceType: string;
  /** Multiplies the cosine score in the rerank. */
  weight: number;
  /** Whether more-recent chunks in this category get a recency boost. */
  recency: boolean;
  /** Render the chunk with provenance for the GM prompt. */
  format: (text: string) => string;
};

const CATEGORIES: readonly Category[] = [
  {
    scope: "owner",
    sourceType: REALM_ENTITY_SOURCE,
    weight: 1,
    recency: false,
    format: (text) => text,
  },
  {
    scope: "campaign",
    sourceType: SESSION_RECAP_SOURCE,
    weight: 1,
    recency: true,
    format: (text) => `From an earlier session: ${text}`,
  },
  {
    // DM-pinned facts get the highest weight so they outrank lore/recaps at
    // similar relevance — the point of pinning is "always keep this in mind".
    scope: "campaign",
    sourceType: PINNED_MEMORY_SOURCE,
    weight: 1.5,
    recency: false,
    format: (text) => `Pinned by the GM (important): ${text}`,
  },
];

/** Linear recency bonus in `[0, RECENCY_WEIGHT]` across a category's hits. */
function recencyBonus(hit: RetrievedChunk, hits: readonly RetrievedChunk[]): number {
  const times = hits.map((h) => h.createdAt.getTime());
  const max = Math.max(...times);
  const min = Math.min(...times);
  if (max === min) return RECENCY_WEIGHT;
  return (RECENCY_WEIGHT * (hit.createdAt.getTime() - min)) / (max - min);
}

export type RetrieveWorldKnowledgeArgs = {
  campaignId: string;
  queryText: string;
  k?: number;
  minScore?: number;
};

/**
 * Reranked grounding (lore + past-session recaps) most relevant to `queryText`,
 * as plain strings ready to drop into a narration prompt. Returns `[]` (never
 * throws) when: embeddings are unconfigured, the query is blank, the campaign has
 * no owner, or anything fails. `deps` is injectable for tests.
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

    const k = args.k ?? DEFAULT_K;
    const min = args.minScore ?? MIN_SCORE;

    const categories = await Promise.all(
      CATEGORIES.map(async (cat) => ({
        cat,
        hits: await deps.retrieve({
          ownerId,
          campaignId: cat.scope === "campaign" ? args.campaignId : undefined,
          sourceTypes: [cat.sourceType],
          queryText: query,
          k: PER_CATEGORY_K,
        }),
      })),
    );

    const ranked = categories.flatMap(({ cat, hits }) =>
      hits
        .filter((h) => h.score >= min)
        .map((h) => ({
          text: cat.format(h.chunkText),
          adjusted:
            h.score * cat.weight + (cat.recency ? recencyBonus(h, hits) : 0),
        })),
    );
    ranked.sort((a, b) => b.adjusted - a.adjusted);
    return ranked.slice(0, k).map((r) => r.text);
  } catch {
    // Best-effort: a retrieval failure must never break the live turn.
    return [];
  }
}
