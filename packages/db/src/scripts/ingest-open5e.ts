/**
 * Manual Open5e SRD spell ingest CLI: `npm run ingest:open5e`.
 *
 * Thin wrapper around the shared `ingestOpen5eSpells()` lib (also used by the
 * nightly Trigger.dev task) — this file only owns the DB connection lifecycle
 * and process exit code.
 *
 * @see packages/db/src/ingest/open5e-spells.ts
 * @see docs/data-sources.md §1
 */
import { closeDb, getDb } from "../client";
import { ingestOpen5eSpells } from "../ingest/open5e-spells";

async function main() {
  const db = getDb();
  const result = await ingestOpen5eSpells({
    db,
    logger: (message) => console.log(message),
  });
  console.log(
    `[ingest:open5e] Done — ${result.upserted} spell(s) from '${result.documentKey}'` +
      `${result.pruned > 0 ? `, pruned ${result.pruned} non-SRD row(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
