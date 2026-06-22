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
  FIXTURE_PARTY,
  buildPartyBattleCommands,
  type BattleAction,
  type Command,
  type CommandSummary,
  type EventStore,
  type FoeSpec,
  type PartyMember,
  type WorldState,
} from "@app/engine";

/** Deterministic clock so a re-seeded room reproduces the same fixture state. */
const FIXED_CLOCK = () => 0;

/** The outcome of applying one action: the legality verdict + (if accepted) the
 * command's summary, so callers can read mechanical results (e.g. an ability
 * check's total/success) without re-reading the event log (#97). */
export type ApplyResult = { accepted: boolean; summary?: CommandSummary };

/** The shared surface the WS server drives, regardless of where state lives. */
export interface LiveRoom {
  ensureSeeded(): Promise<void>;
  apply(action: BattleAction): Promise<ApplyResult>;
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
  async apply(action: BattleAction): Promise<ApplyResult> {
    await this.ensureSeeded();
    const result = await this.engine.execute(FIXTURE_BATTLE_CAMPAIGN_ID, action);
    return result.accepted
      ? { accepted: true, summary: result.summary }
      : { accepted: false };
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
 * The number of events a seed command list produces, by replaying it through a
 * throwaway in-memory engine. This is the "pristine encounter" sequence number:
 * {@link CampaignRoom.reset} truncates a campaign's log back to it so the fight
 * replays from a clean slate, regardless of how many moves were played before.
 * Recomputed from the (deterministic) seed so it stays correct whether the room
 * was seeded with the fixture or a real campaign roster.
 */
async function baselineSequence(commands: readonly Command[]): Promise<number> {
  const probe = new Engine({ now: FIXED_CLOCK });
  const probeId = "probe:seed-baseline";
  for (const command of commands) {
    await probe.execute(probeId, command);
  }
  return (await probe.getEvents(probeId)).length;
}

/** Loads a campaign's active roster as engine-ready party members (#98). */
export type PartyLoader = (campaignId: string) => Promise<PartyMember[]>;

/** Loads a campaign's armed encounter (scene name + foes), if any (CAMP-8). */
export type EncounterLoader = (
  campaignId: string,
) => Promise<{ name: string; foes: FoeSpec[] } | undefined>;

export class CampaignRoom implements LiveRoom {
  private engine: Engine;
  private seeded = false;

  constructor(
    private readonly campaignId: string,
    private readonly store: EventStore,
    /** Optional roster loader; absent → always seed the fixture (tests, demos). */
    private readonly loadParty?: PartyLoader,
    /** Optional authored-encounter loader; absent → default goblin ambush. */
    private readonly loadEncounter?: EncounterLoader,
  ) {
    this.engine = new Engine({ store });
  }

  /**
   * The seed command list for this campaign (#98, CAMP-8): the campaign's real
   * roster (or the fixture party) versus the armed authored encounter's foes (or
   * the default goblin ambush). Both lookups are deterministic enough to also
   * recompute the reset baseline.
   */
  private async seedCommands(): Promise<Command[]> {
    const party = this.loadParty ? await this.loadParty(this.campaignId) : [];
    const members = party.length > 0 ? party : FIXTURE_PARTY;
    const encounter = this.loadEncounter
      ? await this.loadEncounter(this.campaignId)
      : undefined;
    // Untouched campaigns with no roster and no armed encounter reproduce the
    // exact legacy fixture command list (keeps existing baselines stable).
    if (party.length === 0 && !encounter) return FIXTURE_BATTLE_COMMANDS;
    return buildPartyBattleCommands(
      members,
      encounter ? { foes: encounter.foes, sceneName: encounter.name } : undefined,
    );
  }

  /**
   * Load the campaign. If its log is empty (a brand-new campaign), seed the
   * goblin-ambush encounter populated with the real party so there is something
   * to play; otherwise the engine rebuilds the persisted state lazily on first
   * access. Idempotent.
   */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if ((await this.store.lastSequence(this.campaignId)) === 0) {
      for (const command of await this.seedCommands()) {
        await this.engine.execute(this.campaignId, command);
      }
    }
    this.seeded = true;
  }

  async apply(action: BattleAction): Promise<ApplyResult> {
    await this.ensureSeeded();
    const result = await this.engine.execute(this.campaignId, action);
    return result.accepted
      ? { accepted: true, summary: result.summary }
      : { accepted: false };
  }

  /** Truncate the log back to the seeded baseline so the fight replays. */
  async reset(): Promise<void> {
    await this.ensureSeeded();
    const baseline = await baselineSequence(await this.seedCommands());
    await this.store.truncate(this.campaignId, baseline);
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

function isDamage(value: unknown): value is { notation: string; type: string } {
  if (typeof value !== "object" || value === null) return false;
  const d = value as { notation?: unknown; type?: unknown };
  return typeof d.notation === "string" && typeof d.type === "string";
}

/** Validate an untrusted client payload before it reaches the engine. */
export function isBattleAction(value: unknown): value is BattleAction {
  if (typeof value !== "object" || value === null) return false;
  const action = value as {
    type?: unknown;
    entity?: unknown;
    to?: unknown;
    attacker?: unknown;
    reactor?: unknown;
    target?: unknown;
    attackBonus?: unknown;
    damage?: unknown;
    caster?: unknown;
    spellId?: unknown;
    slotLevel?: unknown;
    targets?: unknown;
    origin?: unknown;
    trigger?: unknown;
    action?: unknown;
  };
  if (action.type === "end_turn") return true;
  if (action.type === "ready_action") {
    const inner = action.action as
      | { kind?: unknown; target?: unknown; attackBonus?: unknown; damage?: unknown }
      | undefined;
    return (
      typeof action.entity === "string" &&
      typeof action.trigger === "string" &&
      inner !== undefined &&
      inner.kind === "attack" &&
      typeof inner.target === "string" &&
      typeof inner.attackBonus === "number" &&
      isDamage(inner.damage)
    );
  }
  if (action.type === "trigger_readied") {
    return typeof action.entity === "string";
  }
  if (action.type === "move_entity") {
    return typeof action.entity === "string" && isGridPosition(action.to);
  }
  if (action.type === "attack") {
    return (
      typeof action.attacker === "string" &&
      typeof action.target === "string" &&
      typeof action.attackBonus === "number" &&
      isDamage(action.damage)
    );
  }
  if (action.type === "opportunity_attack") {
    return (
      typeof action.reactor === "string" &&
      typeof action.target === "string" &&
      typeof action.attackBonus === "number" &&
      isDamage(action.damage)
    );
  }
  if (action.type === "cast_spell") {
    return (
      typeof action.caster === "string" &&
      typeof action.spellId === "string" &&
      typeof action.slotLevel === "number" &&
      (action.targets === undefined ||
        (Array.isArray(action.targets) &&
          action.targets.every((t) => typeof t === "string"))) &&
      // Area spells (#99) carry an aim/origin cell the engine resolves from.
      (action.origin === undefined || isGridPosition(action.origin))
    );
  }
  return false;
}
