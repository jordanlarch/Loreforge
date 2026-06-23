/**
 * One-off backfill: embed every existing non-stub Realms entity (MEM-2).
 *
 * Idempotent — `reembedRealmEntities` is contentHash-gated, so re-running only
 * (re-)embeds entities whose composed text changed. Requires a real provider
 * (`OPENAI_API_KEY`); without one the run aborts rather than writing fake
 * vectors. Run via `npm run backfill:embeddings`. Shares the same pass as the
 * nightly `reembed-entities` Trigger task (MEM-7).
 */
import { closeDb, getDb } from "@app/db";

import { resolveEmbeddingClient } from "../client";
import { reembedRealmEntities } from "../reembed";

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "[backfill] OPENAI_API_KEY is required (refusing to write fake vectors).",
    );
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const client = resolveEmbeddingClient();

  const result = await reembedRealmEntities(db, client, {
    onError: (id, error) =>
      console.warn(
        `[backfill] failed for ${id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      ),
  });

  console.info(
    `[backfill] done — total=${result.total} embedded=${result.embedded} ` +
      `unchanged=${result.unchanged} skipped=${result.skipped} ` +
      `failed=${result.failed}`,
  );

  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
