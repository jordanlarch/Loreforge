import { closeDb, getDb } from "../client";
import { seedToolboxFearStress } from "../ingest/seed-toolbox-fear-stress";

async function main() {
  const db = getDb();
  const result = await seedToolboxFearStress(db);
  console.log("[seed:toolbox-fear-stress]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
