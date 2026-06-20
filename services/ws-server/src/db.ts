/**
 * Postgres access for the WS server (#14, scope B).
 *
 * Scope B makes the WS server the *sole authoritative writer* for a live
 * campaign: it loads the campaign's event log from Postgres, applies commands,
 * and appends the resulting events. It reuses `@app/db` so the connection,
 * schema, and `PgEventStore` are identical to the web tRPC runtime (one event
 * store contract, one source of truth). Connection is env-driven (`DATABASE_URL`);
 * `getDb()` is lazy, so importing this module has no side effects.
 */
import { and, eq } from "drizzle-orm";

import { getDb, PgEventStore, campaigns } from "@app/db";
import type { EventStore } from "@app/engine";

let store: EventStore | undefined;

/** The process-wide Postgres-backed event store (built on first use). */
export function getEventStore(): EventStore {
  if (!store) store = new PgEventStore(getDb());
  return store;
}

/** True iff the campaign exists and is owned by the given user. */
export async function isCampaignOwner(
  campaignId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, userId)))
    .limit(1);
  return Boolean(row);
}
