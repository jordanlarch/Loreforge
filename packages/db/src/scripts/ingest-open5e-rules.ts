/**
 * Manual Open5e SRD rules ingest CLI: `npm run ingest:open5e-rules`.
 */
import { closeDb, getDb, ingestOpen5eRules } from "../index";

const db = getDb();
try {
  const result = await ingestOpen5eRules({
    db,
    logger: console.log,
  });
  console.log(
    `[ingest:open5e-rules] Done — ${result.upsertedChapters} chapter(s), ` +
      `${result.upsertedSections} section(s) from '${result.documentKey}'`,
  );
} finally {
  await closeDb();
}
