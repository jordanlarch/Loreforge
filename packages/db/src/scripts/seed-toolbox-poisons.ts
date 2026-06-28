import { closeDb, getDb } from "../client";
import { seedToolboxPoisons } from "../ingest/seed-toolbox-poisons";

async function main() {
  const db = getDb();
  const result = await seedToolboxPoisons(db);
  console.log("[seed:toolbox-poisons]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
