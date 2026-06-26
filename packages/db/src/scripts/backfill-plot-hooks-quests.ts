/**
 * One-time backfill: ensure legacy `plot_hooks` rows have a template snapshot in
 * `data` (Phase D migration helper). Idempotent — skips rows that already have
 * a valid snapshot.
 *
 * Run: `npm run backfill:plot-hooks-quests -w @app/db`
 */
import { backfillQuestInstanceData } from "@app/engine";
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../client";
import { plotHooks } from "../schema/campaigns";

async function main() {
  const db = getDb();
  const rows = await db.select().from(plotHooks);
  let updated = 0;

  for (const row of rows) {
    const next = backfillQuestInstanceData(row.data, {
      title: row.title,
      summary: row.summary,
      sourceEntityId: row.sourceEntityId,
    });
    const prevJson = JSON.stringify(row.data ?? null);
    const nextJson = JSON.stringify(next);
    if (prevJson === nextJson) continue;

    await db
      .update(plotHooks)
      .set({ data: next, updatedAt: new Date() })
      .where(eq(plotHooks.id, row.id));
    updated += 1;
  }

  console.log(
    `[backfill:plot-hooks-quests] Done — updated ${updated} of ${rows.length} rows.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
