/**
 * Postgres-backed {@link EventStore} for the deterministic engine.
 *
 * Implements the same async contract as the engine's `InMemoryEventStore`, so
 * the engine is agnostic to where its event log lives (`@app/engine` never
 * imports `@app/db`; the dependency points one way, db → engine). Events for a
 * campaign are appended to `engine_events` with contiguous per-campaign
 * sequence numbers and read back in order to rebuild `WorldState`.
 *
 * Per-campaign sequencing is computed as `MAX(sequence) + 1`; the
 * `engine_events_campaign_seq_unique` constraint is the correctness backstop
 * that makes concurrent appends fail loudly rather than corrupt the log. The
 * engine tRPC layer additionally serializes commands per campaign via
 * `CampaignCommandQueue`.
 */
import { and, asc, eq, gt, max } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

import type { DraftEvent, EngineEvent, EventStore } from "@app/engine";

import { engineEvents, type EngineEventMeta } from "../schema/engine";

// Driver-agnostic Drizzle handle (postgres-js in prod, PGlite in tests).
type AnyPgDatabase = PgDatabase<any, any, any>;

type EngineEventRow = typeof engineEvents.$inferSelect;

function rowToEvent(row: EngineEventRow): EngineEvent {
  const meta = row.meta;
  return {
    sequence: Number(row.sequence),
    campaignId: row.campaignId,
    timestamp: meta.timestamp,
    causedByCommandId: meta.causedByCommandId,
    actor: meta.actor,
    type: row.type,
    payload: row.payload,
  } as EngineEvent;
}

export class PgEventStore implements EventStore {
  constructor(private readonly db: AnyPgDatabase) {}

  async append(
    campaignId: string,
    events: DraftEvent[],
  ): Promise<EngineEvent[]> {
    if (events.length === 0) return [];

    const base = await this.lastSequence(campaignId);
    const stamped = events.map(
      (draft, i) => ({ ...draft, sequence: base + 1 + i }) as EngineEvent,
    );

    await this.db.insert(engineEvents).values(
      stamped.map((event) => ({
        campaignId,
        sequence: event.sequence,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
        meta: {
          timestamp: event.timestamp,
          causedByCommandId: event.causedByCommandId,
          actor: event.actor,
        } satisfies EngineEventMeta,
      })),
    );

    return stamped;
  }

  async read(campaignId: string): Promise<EngineEvent[]> {
    const rows = await this.db
      .select()
      .from(engineEvents)
      .where(eq(engineEvents.campaignId, campaignId))
      .orderBy(asc(engineEvents.sequence));
    return rows.map(rowToEvent);
  }

  async readAfter(
    campaignId: string,
    afterSequence: number,
  ): Promise<EngineEvent[]> {
    const rows = await this.db
      .select()
      .from(engineEvents)
      .where(
        and(
          eq(engineEvents.campaignId, campaignId),
          gt(engineEvents.sequence, afterSequence),
        ),
      )
      .orderBy(asc(engineEvents.sequence));
    return rows.map(rowToEvent);
  }

  async lastSequence(campaignId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: max(engineEvents.sequence) })
      .from(engineEvents)
      .where(eq(engineEvents.campaignId, campaignId));
    return row?.value != null ? Number(row.value) : 0;
  }

  async truncate(
    campaignId: string,
    throughSequence: number,
  ): Promise<EngineEvent[]> {
    const removed = await this.db
      .select()
      .from(engineEvents)
      .where(
        and(
          eq(engineEvents.campaignId, campaignId),
          gt(engineEvents.sequence, throughSequence),
        ),
      )
      .orderBy(asc(engineEvents.sequence));

    await this.db
      .delete(engineEvents)
      .where(
        and(
          eq(engineEvents.campaignId, campaignId),
          gt(engineEvents.sequence, throughSequence),
        ),
      );

    return removed.map(rowToEvent);
  }
}
