/**
 * Engine — wires the event store, deterministic RNG, projections, and command
 * pipeline together. Server-authoritative source of truth for a campaign's
 * mechanical state (`docs/engine/architecture.md` §2).
 *
 * Randomness is resolved once at command time and recorded in `DiceRolled`
 * events, so replaying the log is fully deterministic. RNG streams are keyed by
 * `${seed}:${scope}:${drawIndex}`; the per-scope draw counter is restored from
 * the log on hydration so a rebuilt engine continues the same stream.
 */
import { createId } from "./id";
import type { Command, CommandResult } from "./commands/types";
import type { ExecutionContext, RollOutcome } from "./commands/context";
import { handleCommand } from "./commands/handlers";
import { rollD20, rollDice, type RollMode } from "./rng/dice";
import { createSeededRng } from "./rng/prng";
import { InMemoryEventStore, type EventStore } from "./events/store";
import type { DraftEvent, EngineEvent } from "./events/types";
import {
  applyEvent,
  emptyWorldState,
  rebuild,
  type WorldState,
} from "./projections/world-state";

export type EngineOptions = {
  store?: EventStore;
  /** Clock injection for deterministic timestamps in tests. */
  now?: () => number;
};

export type ExecuteOptions = {
  /** Idempotent command id; generated if omitted. */
  commandId?: string;
  actor?: string;
};

type CampaignRuntime = {
  seed: string;
  state: WorldState;
  /** Next draw index per RNG scope. */
  drawCounters: Map<string, number>;
};

export class Engine {
  private readonly store: EventStore;
  private readonly now: () => number;
  private readonly runtimes = new Map<string, CampaignRuntime>();

  constructor(options: EngineOptions = {}) {
    this.store = options.store ?? new InMemoryEventStore();
    this.now = options.now ?? Date.now;
  }

  /** Current projected world state for a campaign (hydrating if needed). */
  getState(campaignId: string): WorldState {
    return this.runtime(campaignId).state;
  }

  /** Full ordered event log for a campaign. */
  getEvents(campaignId: string): EngineEvent[] {
    return this.store.read(campaignId);
  }

  /**
   * Validate and execute a command. On acceptance the produced events are
   * appended to the store and the projection advanced incrementally; on
   * rejection nothing is persisted.
   */
  execute(
    campaignId: string,
    command: Command,
    options: ExecuteOptions = {},
  ): CommandResult {
    const runtime = this.runtime(campaignId);
    const commandId = options.commandId ?? createId();
    const drawn: Array<{ scope: string }> = [];

    const ctx: ExecutionContext = {
      campaignId,
      commandId,
      timestamp: this.now(),
      actor: options.actor,
      world: runtime.state,
      roll: (notation, scope, mode) =>
        this.draw(runtime, notation, scope, mode, drawn),
    };

    const result = handleCommand(command, ctx);

    if (!result.accepted) {
      // Roll back any RNG draws this command consumed so a rejected command
      // does not perturb the deterministic stream.
      for (const { scope } of drawn) {
        runtime.drawCounters.set(
          scope,
          (runtime.drawCounters.get(scope) ?? 1) - 1,
        );
      }
      return result;
    }

    const stamped = this.store.append(campaignId, result.events as DraftEvent[]);
    for (const event of stamped) {
      runtime.state = applyEvent(runtime.state, event);
    }
    return { ...result, events: stamped };
  }

  private draw(
    runtime: CampaignRuntime,
    notation: string,
    scope: string,
    mode: RollMode | undefined,
    drawn: Array<{ scope: string }>,
  ): RollOutcome {
    const drawIndex = runtime.drawCounters.get(scope) ?? 0;
    runtime.drawCounters.set(scope, drawIndex + 1);
    drawn.push({ scope });

    const rng = createSeededRng(`${runtime.seed}:${scope}:${drawIndex}`);

    if (mode && mode !== "normal") {
      const a = rollDice(notation, rng);
      const b = rollDice(notation, rng);
      const chosen =
        mode === "advantage"
          ? a.total >= b.total
            ? a
            : b
          : a.total <= b.total
            ? a
            : b;
      return {
        notation,
        rolls: chosen.rolls,
        total: chosen.total,
        scope,
        drawIndex,
      };
    }

    const roll = rollDice(notation, rng);
    return { notation, rolls: roll.rolls, total: roll.total, scope, drawIndex };
  }

  private runtime(campaignId: string): CampaignRuntime {
    let runtime = this.runtimes.get(campaignId);
    if (!runtime) {
      const events = this.store.read(campaignId);
      runtime = {
        seed: campaignId,
        state:
          events.length > 0
            ? rebuild(campaignId, events)
            : emptyWorldState(campaignId),
        drawCounters: restoreDrawCounters(events),
      };
      this.runtimes.set(campaignId, runtime);
    }
    return runtime;
  }
}

/** Re-export rollD20 for callers that want d20 mechanics directly. */
export { rollD20 };

function restoreDrawCounters(events: EngineEvent[]): Map<string, number> {
  const counters = new Map<string, number>();
  for (const event of events) {
    if (event.type === "DiceRolled") {
      const { scope, drawIndex } = event.payload;
      counters.set(scope, Math.max(counters.get(scope) ?? 0, drawIndex + 1));
    }
  }
  return counters;
}
