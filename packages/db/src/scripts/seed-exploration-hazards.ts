import { closeDb, getDb } from "../client";
import { seedExplorationHazards } from "../ingest/seed-exploration-hazards";

async function main() {
  const db = getDb();
  const result = await seedExplorationHazards(db);
  console.log("[seed:exploration-hazards]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
