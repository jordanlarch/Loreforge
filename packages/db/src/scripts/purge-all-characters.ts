/**
 * SRD-AUDIT-8: delete every row in `characters` and related party/invite links.
 * Run once after the 5.1→5.2 audit when legacy characters must not be migrated.
 *
 *   npm run purge:characters
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../client";
import { campaignInvites } from "../schema/campaigns";
import { campaignCharacters, characters } from "../schema/characters";

async function main() {
  const db = getDb();

  const before = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int as n FROM characters`,
  );
  const countBefore = before[0]?.n ?? 0;

  await db.update(campaignInvites).set({ characterId: null });
  const partyRemoved = await db
    .delete(campaignCharacters)
    .returning({ id: campaignCharacters.id });
  const removed = await db
    .delete(characters)
    .returning({ id: characters.id, name: characters.name });

  console.log(
    `[purge:characters] Removed ${removed.length} character(s) (was ${countBefore}), ${partyRemoved.length} campaign party link(s), cleared invite character seats.`,
  );
  if (removed.length > 0) {
    console.log(
      removed.map((r) => `  - ${r.name} (${r.id})`).join("\n"),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
