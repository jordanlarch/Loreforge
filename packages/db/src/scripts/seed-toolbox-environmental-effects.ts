import { closeDb, getDb } from "../client";
import { seedToolboxEnvironmentalEffects } from "../ingest/seed-toolbox-environmental-effects";

async function main() {
  const db = getDb();
  const result = await seedToolboxEnvironmentalEffects(db);
  console.log("[seed:toolbox-environmental-effects]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
