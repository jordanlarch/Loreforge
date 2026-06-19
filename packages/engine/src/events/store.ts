/**
 * Append-only event store.
 *
 * Defines the {@link EventStore} contract used by the engine and a synchronous
 * in-memory implementation for tests and single-process play. A Drizzle/Postgres
 * adapter implements the same contract for persistence (see
 * `docs/engine/architecture.md` §3.3); the engine never depends on a concrete
 * store.
 */
import type { DraftEvent, EngineEvent } from "./types";

export interface EventStore {
  /**
   * Append draft events for a campaign atomically. The store assigns
   * contiguous sequence numbers continuing from the current tail and returns
   * the fully-stamped events in order.
   */
  append(campaignId: string, events: DraftEvent[]): EngineEvent[];
  /** Read all events for a campaign in sequence order. */
  read(campaignId: string): EngineEvent[];
  /** Read events with sequence > `afterSequence`, in order. */
  readAfter(campaignId: string, afterSequence: number): EngineEvent[];
  /** Current highest sequence number for a campaign (0 if none). */
  lastSequence(campaignId: string): number;
  /**
   * Truncate the log to events with sequence <= `throughSequence`. Returns the
   * removed events (newest-first is NOT guaranteed; order is by sequence).
   * Used by retcon (E5) and by tests.
   */
  truncate(campaignId: string, throughSequence: number): EngineEvent[];
}

export class InMemoryEventStore implements EventStore {
  private readonly logs = new Map<string, EngineEvent[]>();

  append(campaignId: string, events: DraftEvent[]): EngineEvent[] {
    const log = this.logs.get(campaignId) ?? [];
    let sequence = log.length === 0 ? 0 : log[log.length - 1]!.sequence;
    const stamped = events.map((draft) => {
      sequence += 1;
      return { ...draft, sequence } as EngineEvent;
    });
    this.logs.set(campaignId, [...log, ...stamped]);
    return stamped;
  }

  read(campaignId: string): EngineEvent[] {
    return [...(this.logs.get(campaignId) ?? [])];
  }

  readAfter(campaignId: string, afterSequence: number): EngineEvent[] {
    return this.read(campaignId).filter((e) => e.sequence > afterSequence);
  }

  lastSequence(campaignId: string): number {
    const log = this.logs.get(campaignId);
    return log && log.length > 0 ? log[log.length - 1]!.sequence : 0;
  }

  truncate(campaignId: string, throughSequence: number): EngineEvent[] {
    const log = this.logs.get(campaignId) ?? [];
    const kept = log.filter((e) => e.sequence <= throughSequence);
    const removed = log.filter((e) => e.sequence > throughSequence);
    this.logs.set(campaignId, kept);
    return removed;
  }
}
