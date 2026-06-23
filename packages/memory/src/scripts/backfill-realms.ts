/**
 * One-off backfill: embed every existing non-stub Realms entity (MEM-2).
 *
 * Idempotent — `upsertSourceEmbeddings` is contentHash-gated, so re-running only
 * (re-)embeds entities whose composed text changed. Requires a real provider
 * (`OPENAI_API_KEY`); without one the run aborts rather than writing fake
 * vectors. Run via `npm run backfill:embeddings`.
 */
import { eq } from "drizzle-orm";

import { closeDb, getDb, realmEntities } from "@app/db";

import { resolveEmbeddingClient } from "../client";
import { embedRealmEntity } from "../store";

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

  const rows = await db
    .select()
    .from(realmEntities)
    .where(eq(realmEntities.isStub, false));

  let embedded = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await embedRealmEntity(db, client, {
        id: row.id,
        ownerId: row.ownerId,
        type: row.type,
        name: row.name,
        summary: row.summary,
        data: row.data,
        isStub: row.isStub,
      });
      if (result.status === "skipped") skipped++;
      else if (result.status === "unchanged") unchanged++;
      else embedded++;
    } catch (error) {
      failed++;
      console.warn(
        `[backfill] failed for ${row.id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.info(
    `[backfill] done — total=${rows.length} embedded=${embedded} ` +
      `unchanged=${unchanged} skipped=${skipped} failed=${failed}`,
  );

  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
