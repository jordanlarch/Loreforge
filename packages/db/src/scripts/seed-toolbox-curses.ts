import { closeDb, getDb } from "../client";
import { seedToolboxCurses } from "../ingest/seed-toolbox-curses";

async function main() {
  const db = getDb();
  const result = await seedToolboxCurses(db);
  console.log("[seed:toolbox-curses]", result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
