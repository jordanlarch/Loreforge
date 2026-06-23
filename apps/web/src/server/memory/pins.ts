/**
 * Pinned-memory embedding glue (#155, P5; `docs/data-sources.md` §6).
 *
 * A pinned memory is a durable DM-authored fact. Its row lives in
 * `pinned_memories` (the editable source of truth); its content is embedded as a
 * `pinned_memory` source in the polymorphic `embeddings` table so it flows
 * through the same `retrieveSimilar` seam as lore + recaps and is weighted high
 * in the live-turn rerank (ws-server `world-knowledge`).
 *
 * Best-effort and env-gated on `OPENAI_API_KEY`: with no key the pin is still
 * recorded, just not embedded (recoverable later via backfill). Embedding must
 * never break the originating pin mutation.
 */
import type { Database } from "@app/db";
import {
  PINNED_MEMORY_SOURCE,
  contentHash,
  deleteSourceEmbeddings,
  resolveEmbeddingClient,
  upsertSourceEmbeddings,
  type EmbeddingClient,
} from "@app/memory";

import { isEmbeddingConfigured } from "./embed";

/**
 * Embed (or re-embed) a pin's content as a `pinned_memory` source,
 * campaign-scoped + owner-set. No-ops when embedding is unconfigured (and no
 * client injected) or the content is blank; never throws.
 */
export async function embedPinBestEffort(
  db: Database,
  args: {
    pinId: string;
    campaignId: string;
    ownerId: string;
    content: string;
    client?: EmbeddingClient;
  },
): Promise<void> {
  const client =
    args.client ?? (isEmbeddingConfigured() ? resolveEmbeddingClient() : null);
  if (!client) return;
  const text = args.content.trim();
  if (!text) return;
  try {
    await upsertSourceEmbeddings(db, client, {
      ownerId: args.ownerId,
      campaignId: args.campaignId,
      sourceType: PINNED_MEMORY_SOURCE,
      sourceId: args.pinId,
      chunks: [{ chunkText: text, contentHash: contentHash(text) }],
    });
  } catch (error) {
    console.warn(
      `[memory] pin embed failed for pin ${args.pinId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Remove a pin's embeddings (called when the pin is deleted). Best-effort: a
 * failure here must not block the row delete. No embedding client needed.
 */
export async function deletePinEmbeddingsBestEffort(
  db: Database,
  pinId: string,
): Promise<void> {
  try {
    await deleteSourceEmbeddings(db, PINNED_MEMORY_SOURCE, pinId);
  } catch (error) {
    console.warn(
      `[memory] pin embedding delete failed for pin ${pinId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
