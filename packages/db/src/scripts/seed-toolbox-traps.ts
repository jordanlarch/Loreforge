import { closeDb, getDb } from "../client";
import { seedToolboxTraps } from "../ingest/seed-toolbox-traps";

async function main() {
  const db = getDb();
  const result = await seedToolboxTraps(db);
  console.log("[seed:toolbox-traps]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
