/**
 * Per-room engine authority (#14).
 *
 * Each live room owns an {@link Engine} that runs the real command path, so the
 * engine remains the sole authority on legality (turn order, movement budget,
 * walls, occupancy). Two room kinds share one {@link LiveRoom} surface:
 *
 * - {@link BattleRoom} (scope A) — an in-memory room seeded from the goblin
 *   ambush fixture. Backs the per-user `sandbox:{userId}` demo. Stateless: a
 *   cold load (restart, idle eviction) re-seeds from the fixture.
 * - {@link CampaignRoom} (scope B) — a Postgres-backed room for a persisted
 *   `campaign:{id}`. The WS server is the sole authoritative writer: it loads
 *   the campaign's event log, seeds the fixture once if the log is empty, and
 *   appends every accepted command. State survives a cold load because it is
 *   rebuilt from the persisted log, not the fixture.
 */
import {
  Engine,
  FIXTURE_BATTLE_CAMPAIGN_ID,
  FIXTURE_BATTLE_COMMANDS,
  type BattleAction,
  type EventStore,
  type WorldState,
} from "@app/engine";

/** Deterministic clock so a re-seeded room reproduces the same fixture state. */
const FIXED_CLOCK = () => 0;

/** The shared surface the WS server drives, regardless of where state lives. */
export interface LiveRoom {
  ensureSeeded(): Promise<void>;
  apply(action: BattleAction): Promise<{ accepted: boolean }>;
  reset(): Promise<void>;
  getState(): Promise<WorldState>;
}

export class BattleRoom implements LiveRoom {
  private engine = new Engine({ now: FIXED_CLOCK });
  private seeded = false;

  /** Replay the fixture command list once; idempotent. */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    for (const command of FIXTURE_BATTLE_COMMANDS) {
      await this.engine.execute(FIXTURE_BATTLE_CAMPAIGN_ID, command);
    }
    this.seeded = true;
  }

  /** Run a player action through the engine; `accepted` is the legality verdict. */
  async apply(action: BattleAction): Promise<{ accepted: boolean }> {
    await this.ensureSeeded();
    const result = await this.engine.execute(FIXTURE_BATTLE_CAMPAIGN_ID, action);
    return { accepted: result.accepted };
  }

  /** Discard all state and rebuild from the fixture (backs the "Reset" control). */
  async reset(): Promise<void> {
    this.engine = new Engine({ now: FIXED_CLOCK });
    this.seeded = false;
    await this.ensureSeeded();
  }

  async getState(): Promise<WorldState> {
    await this.ensureSeeded();
    return this.engine.getState(FIXTURE_BATTLE_CAMPAIGN_ID);
  }
}

/**
 * The number of events the goblin-ambush fixture produces. Computed once by
 * replaying the fixture through a throwaway in-memory engine. This is the
 * "pristine encounter" sequence number: {@link CampaignRoom.reset} truncates a
 * campaign's log back to it so the fight replays from a clean slate, regardless
 * of how many moves were played before.
 */
let fixtureBaseline: Promise<number> | undefined;
function fixtureBaselineSequence(): Promise<number> {
  if (!fixtureBaseline) {
    fixtureBaseline = (async () => {
      const probe = new Engine({ now: FIXED_CLOCK });
      const probeId = "probe:fixture-baseline";
      for (const command of FIXTURE_BATTLE_COMMANDS) {
        await probe.execute(probeId, command);
      }
      return (await probe.getEvents(probeId)).length;
    })();
  }
  return fixtureBaseline;
}

export class CampaignRoom implements LiveRoom {
  private engine: Engine;
  private seeded = false;

  constructor(
    private readonly campaignId: string,
    private readonly store: EventStore,
  ) {
    this.engine = new Engine({ store });
  }

  /**
   * Load the campaign. If its log is empty (a brand-new campaign), seed the
   * goblin-ambush fixture so there is something to play; otherwise the engine
   * rebuilds the persisted state lazily on first access. Idempotent.
   */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if ((await this.store.lastSequence(this.campaignId)) === 0) {
      for (const command of FIXTURE_BATTLE_COMMANDS) {
        await this.engine.execute(this.campaignId, command);
      }
    }
    this.seeded = true;
  }

  async apply(action: BattleAction): Promise<{ accepted: boolean }> {
    await this.ensureSeeded();
    const result = await this.engine.execute(this.campaignId, action);
    return { accepted: result.accepted };
  }

  /** Truncate the log back to the seeded baseline so the fight replays. */
  async reset(): Promise<void> {
    await this.ensureSeeded();
    await this.store.truncate(this.campaignId, await fixtureBaselineSequence());
    // Drop the cached in-memory runtime: a fresh engine re-hydrates from the
    // (now truncated) persisted log.
    this.engine = new Engine({ store: this.store });
  }

  async getState(): Promise<WorldState> {
    await this.ensureSeeded();
    return this.engine.getState(this.campaignId);
  }
}

function isGridPosition(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x: unknown }).x === "number" &&
    typeof (value as { y: unknown }).y === "number"
  );
}

/** Validate an untrusted client payload before it reaches the engine. */
export function isBattleAction(value: unknown): value is BattleAction {
  if (typeof value !== "object" || value === null) return false;
  const action = value as { type?: unknown; entity?: unknown; to?: unknown };
  if (action.type === "end_turn") return true;
  if (action.type === "move_entity") {
    return typeof action.entity === "string" && isGridPosition(action.to);
  }
  return false;
}
