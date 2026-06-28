/**
 * One-off SRD-AUDIT-0: count codex rows by Open5e document key.
 * Run: npm run srd-audit:db (from packages/db)
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../client";

const TABLES = [
  "codex_spells",
  "codex_monsters",
  "codex_items",
  "codex_backgrounds",
  "codex_feats",
  "codex_rule_chapters",
  "codex_rule_sections",
  "codex_advanced_rules",
  "codex_species",
  "codex_classes",
  "codex_subclasses",
] as const;

async function main() {
  const db = getDb();
  const out: Record<string, unknown> = {};

  for (const table of TABLES) {
    if (table === "codex_species" || table === "codex_classes" || table === "codex_subclasses") {
      const rows = await db.execute<{ source: string; n: number }>(
        sql.raw(`SELECT source, count(*)::int as n FROM ${table} GROUP BY 1 ORDER BY 1`),
      );
      out[table] = rows;
      continue;
    }
    const rows = await db.execute<{ doc_key: string; n: number }>(
      sql.raw(
        `SELECT COALESCE(raw->'document'->>'key', '(no document key)') as doc_key, count(*)::int as n FROM ${table} GROUP BY 1 ORDER BY 1`,
      ),
    );
    out[table] = rows;
  }

  const charCount = await db.execute<{ n: number }>(
    sql.raw(`SELECT count(*)::int as n FROM characters`),
  );
  out.characters = charCount;

  console.log(JSON.stringify(out, null, 2));
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
