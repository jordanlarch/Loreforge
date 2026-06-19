import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[@app/db] DATABASE_URL is required");
  }
  if (!client) {
    client = postgres(url, { prepare: false, max: 10 });
  }
  return drizzle(client, { schema });
}

/** Closes the pooled connection so short-lived scripts can exit cleanly. */
export async function closeDb() {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
  }
}

export type Database = ReturnType<typeof getDb>;
