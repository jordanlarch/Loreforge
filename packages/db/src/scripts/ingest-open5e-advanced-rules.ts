/**
 * Manual Open5e advanced rules ingest CLI: `npm run ingest:open5e-advanced-rules`.
 */
import { closeDb, getDb, ingestOpen5eAdvancedRules } from "../index";

const db = getDb();
ingestOpen5eAdvancedRules({
  db,
  logger: (message) => console.log(message),
})
  .then((result) => {
    console.log(
      `[ingest:open5e-advanced-rules] Done — ${result.upserted} rule(s), ` +
        `${result.pruned} pruned`,
    );
  })
  .finally(() => closeDb());
