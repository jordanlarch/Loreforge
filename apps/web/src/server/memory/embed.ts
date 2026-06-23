/**
 * Write-path embedding glue for Realms entities (memory tier, MEM-2).
 *
 * The Realms mutations (create / update / generate / expandStub) call
 * {@link embedRealmEntityOnWrite} after a successful write so the entity becomes
 * retrievable via `memory.search` (and, later, RAG grounding). It is
 * deliberately **best-effort**: embedding never fails the originating mutation,
 * and a missed embed is recoverable via the backfill script.
 *
 * Embedding only runs when a real provider is configured (`OPENAI_API_KEY`); the
 * deterministic fake is for tests/offline only, so we don't pollute the table
 * with meaningless vectors that the contentHash gate would later treat as
 * already-embedded. Tests inject a client explicitly via `options.client`.
 *
 * When a Trigger.dev runtime key (`TRIGGER_SECRET_KEY`) is configured, embedding
 * is dispatched to the durable `embed-entity` job (MEM-7) to keep it off the
 * mutation's request path; otherwise it runs inline (the MEM-2 behavior). The
 * injected-client path always stays inline (tests / offline).
 */
import { tasks } from "@trigger.dev/sdk/v3";

import type { Database } from "@app/db";
import {
  embedRealmEntityBestEffort,
  resolveEmbeddingClient,
  type EmbeddableRealmEntity,
  type EmbeddingClient,
} from "@app/memory";

import type { EmbedEntityPayload } from "@/trigger/embed-entity";

/** Whether write-path embedding is configured (a real provider key present). */
export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Whether the durable (Trigger.dev) embed route can be used at runtime. */
function isTriggerConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export type EmbedRealmEntityOnWriteOptions = {
  /** Injected client (tests). When omitted, resolved from the environment. */
  client?: EmbeddingClient;
};

/**
 * Best-effort embed an entity after it is written. No-ops when embedding is not
 * configured (and no client is injected). Never throws.
 */
export async function embedRealmEntityOnWrite(
  db: Database,
  entity: EmbeddableRealmEntity,
  options: EmbedRealmEntityOnWriteOptions = {},
): Promise<void> {
  // Durable route: hand off to the background job, off the request path (MEM-7).
  // Stubs have nothing to embed; don't spend a dispatch on them.
  if (!options.client && isTriggerConfigured() && !entity.isStub) {
    try {
      const payload: EmbedEntityPayload = { entityId: entity.id };
      await tasks.trigger("embed-entity", payload);
    } catch (error) {
      console.warn(
        `[memory] embed dispatch failed for realm_entity ${entity.id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return;
  }

  const client =
    options.client ?? (isEmbeddingConfigured() ? resolveEmbeddingClient() : null);
  if (!client) return;

  await embedRealmEntityBestEffort(db, client, entity, {
    onResult: (result) => {
      if (result.status === "embedded" && result.embedded > 0) {
        console.info(
          `[memory] embedded realm_entity ${entity.id} (${entity.type}) ` +
            `model=${result.model} tokens=${result.tokens}`,
        );
      }
    },
    onError: (error) => {
      console.warn(
        `[memory] embed failed for realm_entity ${entity.id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });
}
