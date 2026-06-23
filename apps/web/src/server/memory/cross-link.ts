/**
 * Cross-link embedding glue (GEN-5, P5; `docs/data-sources.md` §6).
 *
 * A cross-link is a typed relationship edge between two Realms entities. Its row
 * lives in `realm_relationships` (the source of truth); the edge is rendered into
 * a natural-language sentence and embedded as a `cross_link` source in the
 * polymorphic `embeddings` table, so connections flow through the same
 * `retrieveSimilar` seam as lore + recaps and surface in the live-turn rerank
 * (ws-server `world-knowledge`) — e.g. mentioning a settlement can pull in "X is
 * located in Y".
 *
 * Best-effort and env-gated on `OPENAI_API_KEY`: with no key the edge is still
 * recorded, just not embedded (recoverable via the nightly re-embed / backfill,
 * which is also the catch-all for cascade-created edges). Embedding must never
 * break the originating link mutation.
 */
import type { Database } from "@app/db";
import {
  CROSS_LINK_SOURCE,
  deleteSourceEmbeddings,
  embedCrossLinkBestEffort,
  resolveEmbeddingClient,
  type CrossLinkInput,
  type EmbeddingClient,
} from "@app/memory";

import { isEmbeddingConfigured } from "./embed";

/**
 * Embed (or re-embed) a single relationship edge as a `cross_link` source,
 * owner-scoped, keyed on the relationship id. No-ops when embedding is
 * unconfigured (and no client injected); never throws.
 */
export async function embedCrossLinkOnWrite(
  db: Database,
  link: CrossLinkInput & { relationshipId: string; ownerId: string },
  options: { client?: EmbeddingClient } = {},
): Promise<void> {
  const client =
    options.client ?? (isEmbeddingConfigured() ? resolveEmbeddingClient() : null);
  if (!client) return;
  await embedCrossLinkBestEffort(
    db,
    client,
    {
      id: link.relationshipId,
      ownerId: link.ownerId,
      kind: link.kind,
      fromName: link.fromName,
      fromType: link.fromType,
      toName: link.toName,
      toType: link.toType,
    },
    {
      onError: (error) =>
        console.warn(
          `[memory] cross_link embed failed for ${link.relationshipId}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        ),
    },
  );
}

/**
 * Remove a cross-link's embeddings (called when the edge is unlinked).
 * Best-effort: a failure here must not block the row delete.
 */
export async function deleteCrossLinkEmbeddingsBestEffort(
  db: Database,
  relationshipId: string,
): Promise<void> {
  try {
    await deleteSourceEmbeddings(db, CROSS_LINK_SOURCE, relationshipId);
  } catch (error) {
    console.warn(
      `[memory] cross_link embedding delete failed for ${relationshipId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
