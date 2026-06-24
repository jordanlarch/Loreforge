/**
 * Manual Open5e SRD creature ingest CLI: `npm run ingest:open5e-creatures`.
 */
import { closeDb, getDb } from "../client";
import { ingestOpen5eCreatures } from "../ingest/open5e-creatures";

async function main() {
  const db = getDb();
  const result = await ingestOpen5eCreatures({
    db,
    logger: (message) => console.log(message),
  });
  console.log(
    `[ingest:open5e-creatures] Done — ${result.upserted} creature(s) from '${result.documentKey}'` +
      `${result.pruned > 0 ? `, pruned ${result.pruned} non-SRD row(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
