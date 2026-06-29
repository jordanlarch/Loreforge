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
  buildCampaignExplorationCommands,
  buildDungeonCombatStartCommands,
  buildDungeonEntryCommands,
  buildEnterLocationCommands,
  buildEnvironmentalEffectEnterCommands,
  buildLocationNpcCommands,
  resolveLocationEnvironmentalEffectSlugs,
  buildPartyBattleCommands,
  buildPartyMemberJoinCommands,
  DEFAULT_STARTING_LOCATION,
  entityIdFromSceneId,
  MAX_BATTLE_PARTY,
  resolveDungeonFoes,
  sceneIdForRealmEntity,
  type BattleAction,
  type CampaignStartingLocation,
  type Command,
  type CommandSummary,
  type EncounterMapDef,
  type EventStore,
  type FoeSpec,
  type LocationNpcSpec,
  type PartyMember,
  type WorldState,
} from "@app/engine";

import { grantPoisonDemoLoot, grantCurseDemoLoot } from "./db.js";

/** Deterministic clock so a re-seeded room reproduces the same fixture state. */
export const FIXED_CLOCK = () => 0;

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
export async function baselineSequence(
  commands: readonly Command[],
): Promise<number> {
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
) => Promise<
  { name: string; foes: FoeSpec[]; map: EncounterMapDef } | undefined
>;

export type StartingLocationLoader = (
  campaignId: string,
) => Promise<CampaignStartingLocation | undefined>;

/** NPCs + entity data for location enter / exploration seed (Rung 4 Slice 3). */
export type LocationExtrasLoader = (
  campaignId: string,
  locationEntityId: string,
) => Promise<{
  npcs: LocationNpcSpec[];
  entityData?: Record<string, unknown>;
}>;

export type LocationEnterExtras = {
  npcs?: readonly LocationNpcSpec[];
  entityData?: Record<string, unknown>;
};

export class CampaignRoom implements LiveRoom {
  private engine: Engine;
  private seeded = false;

  constructor(
    private readonly campaignId: string,
    private readonly store: EventStore,
    /** Optional roster loader; absent → always seed the fixture (tests, demos). */
    private readonly loadParty?: PartyLoader,
    /** Optional authored-encounter loader; absent → legacy fixture combat. */
    private readonly loadEncounter?: EncounterLoader,
    /** Optional World-tab location loader for exploration bootstrap (Rung 4). */
    private readonly loadStartingLocation?: StartingLocationLoader,
    /** Optional NPC / dungeon-data loader for exploration maps (Rung 4 Slice 3). */
    private readonly loadLocationExtras?: LocationExtrasLoader,
  ) {
    this.engine = new Engine({ store });
  }

  /**
   * The seed command list for this campaign (#98, CAMP-8, Rung 4): armed encounter
   * → combat; otherwise exploration at the first World-tab location (or generic
   * fallback). Unit tests without DB loaders keep the legacy goblin fixture.
   */
  private async seedCommands(): Promise<Command[]> {
    const party = this.loadParty ? await this.loadParty(this.campaignId) : [];
    const members = party.length > 0 ? party : FIXTURE_PARTY;
    const encounter = this.loadEncounter
      ? await this.loadEncounter(this.campaignId)
      : undefined;

    if (encounter) {
      return buildPartyBattleCommands(members, {
        foes: encounter.foes,
        sceneName: encounter.name,
        map: encounter.map,
      });
    }

    if (this.loadParty || this.loadStartingLocation) {
      const location =
        (this.loadStartingLocation
          ? await this.loadStartingLocation(this.campaignId)
          : undefined) ?? DEFAULT_STARTING_LOCATION;
      const commands = buildCampaignExplorationCommands(members, location);
      const extras = this.loadLocationExtras
        ? await this.loadLocationExtras(this.campaignId, location.entityId)
        : undefined;

      if (location.type === "dungeon") {
        const foes = resolveDungeonFoes(
          location.entityId,
          extras?.entityData,
        );
        const partyIds = members.slice(0, MAX_BATTLE_PARTY).map((m) => m.id);
        commands.push(
          ...buildDungeonCombatStartCommands(location, partyIds, foes),
        );
      } else if (extras?.npcs.length) {
        const sceneId = sceneIdForRealmEntity(location.entityId);
        const emptyState = { scenes: {}, entities: {} } as WorldState;
        commands.push(
          ...buildLocationNpcCommands(sceneId, extras.npcs, emptyState),
        );
      }
      return commands;
    }

    return FIXTURE_BATTLE_COMMANDS;
  }

  /**
   * Load the campaign. If its log is empty (a brand-new campaign), seed an
   * exploration scene (or armed encounter when set); otherwise the engine
   * rebuilds the persisted state lazily on first access. Idempotent.
   */
  async ensureSeeded(): Promise<void> {
    const lastSeq = await this.store.lastSequence(this.campaignId);
    // CAMP-8 Run Now truncates the log from the web app while this room may
    // still be cached in memory — re-seed when the log is empty again.
    if (this.seeded && lastSeq === 0) {
      this.engine = new Engine({ store: this.store });
      this.seeded = false;
    }
    if (this.seeded) return;
    if (lastSeq === 0) {
      for (const command of await this.seedCommands()) {
        await this.engine.execute(this.campaignId, command);
      }
      const location = this.loadStartingLocation
        ? await this.loadStartingLocation(this.campaignId)
        : undefined;
      if (location?.type === "dungeon") {
        await grantPoisonDemoLoot(this.campaignId);
        await grantCurseDemoLoot(this.campaignId);
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

  /**
   * Place roster members who joined after the live session was seeded onto the
   * current scene (and into an active encounter when one is running).
   */
  async syncMissingPartyMembers(): Promise<number> {
    await this.ensureSeeded();
    if (!this.loadParty) return 0;
    const party = await this.loadParty(this.campaignId);
    let state = await this.getState();
    let applied = 0;
    for (const member of party) {
      const commands = buildPartyMemberJoinCommands(member, state);
      for (const command of commands) {
        const result = await this.engine.execute(this.campaignId, command);
        if (result.accepted) applied += 1;
      }
      if (commands.length > 0) {
        state = await this.engine.getState(this.campaignId);
      }
    }
    return applied;
  }

  /**
   * Travel to a Realms World-tab location (Rung 4 Slice 2–3). Blocked during
   * combat; no-op when already at the destination scene. Dungeons start combat
   * on enter; other locations spawn ambient NPC tokens when available.
   */
  async enterLocation(
    location: CampaignStartingLocation,
    extras?: LocationEnterExtras,
  ): Promise<{ changed: boolean; startedCombat: boolean }> {
    await this.ensureSeeded();
    const state = await this.getState();
    if (state.encounter) return { changed: false, startedCombat: false };

    const sceneId = sceneIdForRealmEntity(location.entityId);
    if (state.currentSceneId === sceneId) {
      return { changed: false, startedCombat: false };
    }

    const resolved =
      extras ??
      (this.loadLocationExtras
        ? await this.loadLocationExtras(this.campaignId, location.entityId)
        : undefined);

    if (location.type === "dungeon") {
      const foes = resolveDungeonFoes(
        location.entityId,
        resolved?.entityData,
      );
      for (const command of buildDungeonEntryCommands(location, state, foes)) {
        await this.engine.execute(this.campaignId, command);
      }
      await this.applyEnvironmentalEffectsOnEnter(location, resolved?.entityData);
      return { changed: true, startedCombat: true };
    }

    for (const command of buildEnterLocationCommands(location, state)) {
      await this.engine.execute(this.campaignId, command);
    }
    const afterEnter = await this.getState();
    const npcs = resolved?.npcs ?? [];
    if (npcs.length > 0) {
      for (const command of buildLocationNpcCommands(
        sceneId,
        npcs,
        afterEnter,
      )) {
        await this.engine.execute(this.campaignId, command);
      }
    }
    await this.applyEnvironmentalEffectsOnEnter(location, resolved?.entityData);
    return { changed: true, startedCombat: false };
  }

  /** GRILL-LIVE-ENV-EFFECT Q4 — ambient slugs + auto-apply for party on enter. */
  private async applyEnvironmentalEffectsOnEnter(
    location: CampaignStartingLocation,
    entityData?: Record<string, unknown>,
  ): Promise<void> {
    const slugs = resolveLocationEnvironmentalEffectSlugs(location, entityData);
    if (slugs.length === 0) return;

    const state = await this.getState();
    const sceneId = sceneIdForRealmEntity(location.entityId);
    const partyIds = Object.values(state.entities)
      .filter((e) => e.kind === "character" && !e.id.startsWith("npc:"))
      .map((e) => e.id);

    for (const command of buildEnvironmentalEffectEnterCommands(
      sceneId,
      slugs,
      partyIds,
    )) {
      await this.engine.execute(this.campaignId, command);
    }
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
    rangeFt?: unknown;
    caster?: unknown;
    spellId?: unknown;
    slotLevel?: unknown;
    targets?: unknown;
    origin?: unknown;
    trigger?: unknown;
    action?: unknown;
    sceneId?: unknown;
    trapInstanceId?: unknown;
    poisonSlug?: unknown;
    curseSlug?: unknown;
    instanceId?: unknown;
  };
  if (action.type === "end_turn") return true;
  if (action.type === "ready_action") {
    const inner = action.action as
      | {
          kind?: unknown;
          target?: unknown;
          attackBonus?: unknown;
          damage?: unknown;
          rangeFt?: unknown;
        }
      | undefined;
    return (
      typeof action.entity === "string" &&
      typeof action.trigger === "string" &&
      inner !== undefined &&
      inner.kind === "attack" &&
      typeof inner.target === "string" &&
      typeof inner.attackBonus === "number" &&
      isDamage(inner.damage) &&
      (inner.rangeFt === undefined || typeof inner.rangeFt === "number")
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
      isDamage(action.damage) &&
      (action.rangeFt === undefined || typeof action.rangeFt === "number")
    );
  }
  if (action.type === "opportunity_attack") {
    return (
      typeof action.reactor === "string" &&
      typeof action.target === "string" &&
      typeof action.attackBonus === "number" &&
      isDamage(action.damage) &&
      (action.rangeFt === undefined || typeof action.rangeFt === "number")
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
  if (action.type === "detect_trap" || action.type === "disable_trap") {
    return (
      typeof action.entity === "string" &&
      typeof action.sceneId === "string" &&
      typeof action.trapInstanceId === "string"
    );
  }
  if (action.type === "coat_weapon") {
    return (
      typeof action.entity === "string" && typeof action.poisonSlug === "string"
    );
  }
  if (action.type === "apply_poison") {
    return (
      typeof action.target === "string" && typeof action.poisonSlug === "string"
    );
  }
  if (action.type === "apply_curse") {
    return (
      typeof action.target === "string" && typeof action.curseSlug === "string"
    );
  }
  if (action.type === "remove_curse") {
    return (
      typeof action.target === "string" && typeof action.instanceId === "string"
    );
  }
  return false;
}
