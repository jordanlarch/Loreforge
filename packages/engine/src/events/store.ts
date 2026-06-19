/**
 * Append-only event store.
 *
 * Defines the {@link EventStore} contract used by the engine and an in-memory
 * implementation for tests and single-process play. The contract is async so a
 * Drizzle/Postgres adapter (`PgEventStore` in `@app/db`) implements the same
 * methods for persistence (see `docs/engine/architecture.md` §3.3); the engine
 * never depends on a concrete store. The in-memory store satisfies the async
 * contract by resolving immediately.
 */
import type { DraftEvent, EngineEvent } from "./types";

export interface EventStore {
  /**
   * Append draft events for a campaign atomically. The store assigns
   * contiguous sequence numbers continuing from the current tail and returns
   * the fully-stamped events in order.
   */
  append(campaignId: string, events: DraftEvent[]): Promise<EngineEvent[]>;
  /** Read all events for a campaign in sequence order. */
  read(campaignId: string): Promise<EngineEvent[]>;
  /** Read events with sequence > `afterSequence`, in order. */
  readAfter(campaignId: string, afterSequence: number): Promise<EngineEvent[]>;
  /** Current highest sequence number for a campaign (0 if none). */
  lastSequence(campaignId: string): Promise<number>;
  /**
   * Truncate the log to events with sequence <= `throughSequence`. Returns the
   * removed events (order is by sequence). Used by retcon (E5) and by tests.
   */
  truncate(
    campaignId: string,
    throughSequence: number,
  ): Promise<EngineEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly logs = new Map<string, EngineEvent[]>();

  async append(
    campaignId: string,
    events: DraftEvent[],
  ): Promise<EngineEvent[]> {
    const log = this.logs.get(campaignId) ?? [];
    let sequence = log.length === 0 ? 0 : log[log.length - 1]!.sequence;
    const stamped = events.map((draft) => {
      sequence += 1;
      return { ...draft, sequence } as EngineEvent;
    });
    this.logs.set(campaignId, [...log, ...stamped]);
    return stamped;
  }

  async read(campaignId: string): Promise<EngineEvent[]> {
    return [...(this.logs.get(campaignId) ?? [])];
  }

  async readAfter(
    campaignId: string,
    afterSequence: number,
  ): Promise<EngineEvent[]> {
    return (await this.read(campaignId)).filter(
      (e) => e.sequence > afterSequence,
    );
  }

  async lastSequence(campaignId: string): Promise<number> {
    const log = this.logs.get(campaignId);
    return log && log.length > 0 ? log[log.length - 1]!.sequence : 0;
  }

  async truncate(
    campaignId: string,
    throughSequence: number,
  ): Promise<EngineEvent[]> {
    const log = this.logs.get(campaignId) ?? [];
    const kept = log.filter((e) => e.sequence <= throughSequence);
    const removed = log.filter((e) => e.sequence > throughSequence);
    this.logs.set(campaignId, kept);
    return removed;
  }
}
