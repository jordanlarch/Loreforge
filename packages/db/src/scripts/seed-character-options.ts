/**
 * Manual SRD character-options seed CLI: `npm run seed:character-options`.
 *
 * Thin wrapper around the shared `seedCharacterOptions()` lib (also run by the
 * nightly Trigger.dev task) — owns only the DB connection lifecycle and exit
 * code. Idempotent: upserts by slug.
 *
 * @see packages/db/src/ingest/srd-character-options.ts
 */
import { closeDb, getDb } from "../client";
import { seedCharacterOptions } from "../ingest/srd-character-options";

async function main() {
  const db = getDb();
  const result = await seedCharacterOptions(db);
  console.log(
    `[seed:character-options] Done — ${result.species} species, ${result.classes} classes.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
