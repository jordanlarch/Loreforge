/**
 * Manual Open5e SRD item ingest CLI: `npm run ingest:open5e-items`.
 */
import { closeDb, getDb } from "../client";
import { ingestOpen5eItems } from "../ingest/open5e-items";

async function main() {
  const db = getDb();
  const result = await ingestOpen5eItems({
    db,
    logger: (message) => console.log(message),
  });
  console.log(
    `[ingest:open5e-items] Done — ${result.upserted} item(s) from '${result.documentKey}'` +
      `${result.pruned > 0 ? `, pruned ${result.pruned} non-SRD row(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
