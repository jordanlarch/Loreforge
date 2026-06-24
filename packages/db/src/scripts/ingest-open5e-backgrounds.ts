import { closeDb, getDb } from "../client";
import { ingestOpen5eBackgrounds } from "../ingest/open5e-backgrounds";

async function main() {
  const db = getDb();
  const result = await ingestOpen5eBackgrounds({
    db,
    logger: (message) => console.log(message),
  });
  console.log(
    `[ingest:open5e-backgrounds] Done — ${result.upserted} background(s) from '${result.documentKey}'` +
      `${result.pruned > 0 ? `, pruned ${result.pruned} non-SRD row(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
