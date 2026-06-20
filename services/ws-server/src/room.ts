/**
 * Per-room engine authority (#14, scope A).
 *
 * Each live room owns its own in-memory {@link Engine} seeded from the goblin
 * ambush fixture. Commands run through the real engine command path, so the
 * engine remains the sole authority on legality (turn order, movement budget,
 * walls, occupancy) — exactly as the sandbox `simulateBattle` does today, but
 * holding persistent state instead of replaying from scratch each move.
 *
 * Scope A is deliberately stateless: rooms live in memory only, and a cold load
 * (server restart, idle eviction) re-seeds from the fixture. Scope B swaps the
 * seed source for a Postgres event-store rebuild without changing this surface.
 */
import {
  Engine,
  FIXTURE_BATTLE_CAMPAIGN_ID,
  FIXTURE_BATTLE_COMMANDS,
  type BattleAction,
  type WorldState,
} from "@app/engine";

/** Deterministic clock so a re-seeded room reproduces the same fixture state. */
const FIXED_CLOCK = () => 0;

export class BattleRoom {
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
