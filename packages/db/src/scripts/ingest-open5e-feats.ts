import { closeDb, getDb } from "../client";
import { ingestOpen5eFeats } from "../ingest/open5e-feats";

async function main() {
  const db = getDb();
  const result = await ingestOpen5eFeats({
    db,
    logger: (message) => console.log(message),
  });
  console.log(
    `[ingest:open5e-feats] Done — ${result.upserted} feat(s) from '${result.documentKey}'` +
      `${result.pruned > 0 ? `, pruned ${result.pruned} non-SRD row(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
