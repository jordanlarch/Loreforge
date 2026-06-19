/**
 * P0 spike: fetch a page of Open5e spells and upsert into codex_spells.
 * Not scheduled yet — run manually: npm run ingest:open5e
 * @see docs/data-sources.md §1
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../client";
import { codexSpells } from "../schema/codex";

const OPEN5E_SPELLS_URL =
  "https://api.open5e.com/v2/spells/?limit=25&format=json";

type Open5eListResponse = {
  results: Array<{
    key: string;
    name: string;
    level?: number;
    school?: { name?: string };
    [key: string]: unknown;
  }>;
};

async function main() {
  const db = getDb();
  console.log("[ingest:open5e] Fetching", OPEN5E_SPELLS_URL);

  const res = await fetch(OPEN5E_SPELLS_URL);
  if (!res.ok) {
    throw new Error(`Open5e API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as Open5eListResponse;
  let upserted = 0;

  for (const spell of data.results) {
    const slug = spell.key.replace(/\//g, "-");
    await db
      .insert(codexSpells)
      .values({
        slug,
        name: spell.name,
        level: spell.level != null ? String(spell.level) : null,
        school: spell.school?.name ?? null,
        source: "open5e",
        raw: spell as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: codexSpells.slug,
        set: {
          name: spell.name,
          level: spell.level != null ? String(spell.level) : null,
          school: spell.school?.name ?? null,
          raw: spell as Record<string, unknown>,
          ingestedAt: sql`now()`,
        },
      });
    upserted++;
  }

  console.log(`[ingest:open5e] Upserted ${upserted} spells`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
