/**
 * Campaign exploration bootstrap (Rung 4) — seed Live Play with a Realms location
 * scene + party tokens, **without** starting combat. Mirrors the tutorial's
 * arrival scenes (`create_scene` → `change_scene` → place PCs); combat only
 * begins when fiction requires it (armed encounter, Run Now, or in-fiction trigger).
 */
import {
  buildLayoutState,
  cellsForEntitySpawn,
  floorByIndex,
  loadDungeonFloors,
} from "../dungeon/layout";
import {
  resolveRoomEncounterTemplate,
  resolveWanderingMonsterTemplate,
} from "../dungeon/encounter-ref";
import type { Command } from "../commands/types";
import type {
  AbilityScores,
  EntityRef,
  GridPosition,
  SceneKind,
  SceneState,
  SceneTrapInstance,
} from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { monsterTemplate } from "../content/monsters";
import {
  expandEncounterFoes,
  FIXTURE_BATTLE_FOES_SIDE,
  FIXTURE_BATTLE_PARTY_SIDE,
  MAX_BATTLE_PARTY,
  type FoeSpec,
  type PartyMember,
} from "./battle";
import {
  formatQuestTeaseLine,
  resolveQuestTeaseTextWithInheritance,
  type QuestTeaseTrigger,
} from "../quests";

/** Realms types that can host an explorable interior/overland map in Live Play. */
export type ExplorableRealmType =
  | "tavern"
  | "settlement"
  | "building"
  | "shop"
  | "region"
  | "dungeon";

/** A World-tab location the WS server resolves for the opening scene. */
export type CampaignStartingLocation = {
  /** Realms entity uuid, or `"generic"` when the campaign has no world members yet. */
  entityId: string;
  name: string;
  summary: string;
  type: ExplorableRealmType;
  /** First Realms-embedded plot hook for opening/arrival narration (Rung 4 Slice 3). */
  openingHook?: string;
};

/** Fallback when a campaign has no explorable World-tab entities yet. */
export const DEFAULT_STARTING_LOCATION: CampaignStartingLocation = {
  entityId: "generic",
  name: "Traveler's Rest",
  summary:
    "A modest roadside stop — firelight, empty benches, and the smell of rain on wool.",
  type: "tavern",
};

/** Stable scene id for a Realms-backed location (one scene per entity). */
export function sceneIdForRealmEntity(entityId: string): string {
  return entityId === "generic"
    ? "scene:travelers-rest"
    : `scene:realm:${entityId}`;
}

/** One scene per dungeon floor; rooms on the same floor share that scene (RUNG-4). */
export function sceneIdForDungeonFloor(
  dungeonEntityId: string,
  floorIndex: number,
): string {
  return `${sceneIdForRealmEntity(dungeonEntityId)}:floor:${floorIndex}`;
}

/** @deprecated Prefer {@link sceneIdForDungeonFloor} with the room's floor index. */
export function sceneIdForDungeonRoom(
  dungeonEntityId: string,
  roomIndex: number,
  data?: unknown,
): string {
  return sceneIdForDungeonFloor(
    dungeonEntityId,
    data ? dungeonFloorIndexAt(data, roomIndex) : 0,
  );
}

import {
  dungeonFloorIndexAt,
  dungeonRoomAt,
  parseDungeonRooms,
  zoneIdForRoomIndex,
  type ParsedDungeonRoom,
} from "../dungeon/rooms";
export {
  dungeonFloorIndexAt,
  dungeonRoomAt,
  parseDungeonRooms,
  zoneIdForRoomIndex,
  type ParsedDungeonRoom,
};

export function floorSceneLabel(
  locationName: string,
  floorIndex: number,
): string {
  return floorIndex === 0
    ? `${locationName} — Ground Level`
    : `${locationName} — Floor ${floorIndex + 1}`;
}

/** Reverse {@link sceneIdForRealmEntity} for Realms-backed scenes. */
export function entityIdFromSceneId(sceneId: string | undefined): string | undefined {
  if (!sceneId) return undefined;
  if (sceneId === "scene:travelers-rest") return "generic";
  const prefix = "scene:realm:";
  if (!sceneId.startsWith(prefix)) return undefined;
  const rest = sceneId.slice(prefix.length);
  for (const suffix of [":floor:", ":room:"] as const) {
    const idx = rest.indexOf(suffix);
    if (idx !== -1) return rest.slice(0, idx);
  }
  return rest;
}

export function isExplorableRealmType(type: string): type is ExplorableRealmType {
  return (
    type === "tavern" ||
    type === "settlement" ||
    type === "building" ||
    type === "shop" ||
    type === "region" ||
    type === "dungeon"
  );
}

type ExplorationMapDef = {
  width: number;
  height: number;
  blockedCells: GridPosition[];
  description: string;
};

const TAVERN_WALLS: GridPosition[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 7, y: 5 },
  { x: 8, y: 2 },
];

const SETTLEMENT_WALLS: GridPosition[] = [
  { x: 3, y: 3 },
  { x: 10, y: 3 },
  { x: 6, y: 8 },
  { x: 7, y: 8 },
];

const INTERIOR_WALLS: GridPosition[] = [
  { x: 2, y: 2 },
  { x: 7, y: 2 },
  { x: 4, y: 5 },
];

const REGION_WALLS: GridPosition[] = [
  { x: 4, y: 4 },
  { x: 11, y: 4 },
  { x: 8, y: 9 },
];

const DUNGEON_WALLS: GridPosition[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 8, y: 1 },
  { x: 5, y: 5 },
  { x: 5, y: 6 },
];

const DUNGEON_DEMO_TRAP: SceneTrapInstance = {
  instanceId: "trap:demo-poison-needle",
  trapSlug: "srd-2024_poison-needle",
  position: { x: 5, y: 5 },
  detected: false,
  disabled: false,
  triggered: false,
};

function sceneKindForLocation(type: ExplorableRealmType): SceneKind {
  return type;
}

function trapsForLocation(type: ExplorableRealmType): SceneTrapInstance[] | undefined {
  if (type !== "dungeon") return undefined;
  return [DUNGEON_DEMO_TRAP];
}

function buildExplorationScene(
  sceneId: string,
  location: Pick<CampaignStartingLocation, "name" | "type">,
  map: ExplorationMapDef,
): SceneState {
  return {
    id: sceneId,
    name: location.name,
    description: map.description,
    sceneKind: sceneKindForLocation(location.type),
    map: {
      width: map.width,
      height: map.height,
      blockedCells: map.blockedCells,
    },
    ...(trapsForLocation(location.type)
      ? { traps: trapsForLocation(location.type) }
      : {}),
  };
}

export function mapForType(type: ExplorableRealmType): ExplorationMapDef {
  switch (type) {
    case "tavern":
      return {
        width: 10,
        height: 8,
        blockedCells: TAVERN_WALLS,
        description: "Tables, a bar, and the low murmur of a hearth.",
      };
    case "settlement":
      return {
        width: 14,
        height: 12,
        blockedCells: SETTLEMENT_WALLS,
        description: "A crossroads of lanes, market stalls, and watchful windows.",
      };
    case "building":
    case "shop":
      return {
        width: 10,
        height: 8,
        blockedCells: INTERIOR_WALLS,
        description: "Walls, shelves, and the hush of an enclosed space.",
      };
    case "region":
      return {
        width: 16,
        height: 12,
        blockedCells: REGION_WALLS,
        description: "Open ground, wind, and distant landmarks on the horizon.",
      };
    case "dungeon":
      return {
        width: 12,
        height: 10,
        blockedCells: DUNGEON_WALLS,
        description: "Stone passages, uneven footing, and deep shadow.",
      };
  }
}

/** Party entry cells — bottom-centre row, scanned left-to-right. */
const EXPLORATION_STARTS: readonly GridPosition[] = [
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 3, y: 6 },
  { x: 6, y: 6 },
];

function defaultBlurb(type: ExplorableRealmType): string {
  switch (type) {
    case "tavern":
      return "The hearth throws warm light across worn floorboards.";
    case "settlement":
      return "The settlement hums with the ordinary rhythm of daily life.";
    case "building":
      return "You step inside, boots echoing on the floor.";
    case "shop":
      return "Shelves and counters line the room, waiting for trade.";
    case "region":
      return "The land opens before you under a wide sky.";
    case "dungeon":
      return "Cold air and old stone greet you at the threshold.";
  }
}

export type OpeningHookOptions = {
  trigger?: QuestTeaseTrigger;
  locationEntityId?: string;
  /** Cascade parent data when the location stub has no quests (Phase A.1). */
  parentData?: unknown;
};

/**
 * Resolve quest tease copy for Live Play (Phase A trigger evaluator).
 * Auto-migrates legacy `data.hooks` strings; inherits from parent when empty.
 */
export function extractOpeningHookText(
  data: unknown,
  options?: OpeningHookOptions,
): string | undefined {
  const trigger = options?.trigger ?? "on_session_start";
  const locationEntityId = options?.locationEntityId ?? "";
  return resolveQuestTeaseTextWithInheritance(
    data,
    trigger,
    { locationEntityId },
    options?.parentData,
  );
}

function hookTease(hook: string | undefined): string {
  if (!hook?.trim()) return "";
  return formatQuestTeaseLine(hook);
}

/**
 * Canned opening GM line for a fresh campaign load (LLM-free; the orchestrator
 * may replace it on the player's first message when configured).
 */
export function openingNarrationForLocation(loc: CampaignStartingLocation): {
  text: string;
  mentions: string[];
} {
  const blurb = loc.summary.trim() || defaultBlurb(loc.type);
  const hook = hookTease(loc.openingHook);
  return {
    text: `You arrive at ${loc.name}. ${blurb} ${hook}What do you do?`.replace(
      "  ",
      " ",
    ),
    mentions: [loc.name],
  };
}

/** GM line after the party travels to a new Realms location (Rung 4 Slice 2). */
export function arrivalNarrationForLocation(
  loc: CampaignStartingLocation,
  entityData?: Record<string, unknown>,
): {
  text: string;
  mentions: string[];
} {
  if (loc.type === "dungeon") {
    const room = firstDungeonRoom(entityData);
    const roomLead = room ? `You reach ${room.name}. ` : "";
    return {
      text: `${roomLead}You descend into ${loc.name}. ${loc.summary.trim() || defaultBlurb(loc.type)} Something hostile stirs in the dark.`,
      mentions: room ? [room.name, loc.name] : [loc.name],
    };
  }
  const blurb = loc.summary.trim() || defaultBlurb(loc.type);
  const hook = hookTease(loc.openingHook);
  return {
    text: `You make your way to ${loc.name}. ${blurb} ${hook}`.trim(),
    mentions: [loc.name],
  };
}

/**
 * Match a free-text travel attempt against campaign World-tab locations.
 * Returns the best destination when the player names a place or uses a type
 * shorthand ("go to the tavern") — LLM-free so Speak-mode travel works offline.
 */
export function matchTravelDestination(
  text: string,
  locations: readonly CampaignStartingLocation[],
  currentEntityId?: string,
): CampaignStartingLocation | undefined {
  if (locations.length === 0) return undefined;
  const lower = text.toLowerCase().trim();
  const hasTravelIntent =
    /\b(go to|head to|travel to|walk to|make my way to|go inside|head into|step into|enter the|inside the)\b/.test(
      lower,
    ) || /\b(go|head|walk|travel|visit|enter)\b/.test(lower);

  const candidates = locations.filter((l) => l.entityId !== currentEntityId);
  const byName = [...candidates].sort((a, b) => b.name.length - a.name.length);
  for (const loc of byName) {
    const nameLower = loc.name.toLowerCase();
    if (!lower.includes(nameLower)) continue;
    if (
      hasTravelIntent ||
      lower.includes(`to ${nameLower}`) ||
      lower.includes(`to the ${nameLower}`)
    ) {
      return loc;
    }
  }

  if (!hasTravelIntent) return undefined;

  const typePatterns: { re: RegExp; type: ExplorableRealmType }[] = [
    { re: /\b(the |a )?(tavern|inn)\b/, type: "tavern" },
    { re: /\b(the |a )?(settlement|town|village|hamlet|city)\b/, type: "settlement" },
    { re: /\b(the |a )?(shop|market|store)\b/, type: "shop" },
    { re: /\b(the |a )?(building|house|hall)\b/, type: "building" },
    { re: /\b(the |a )?(dungeon|crypt|cavern)\b/, type: "dungeon" },
    { re: /\b(the |a )?(region|wilds|road|wilderness)\b/, type: "region" },
  ];
  for (const { re, type } of typePatterns) {
    if (!re.test(lower)) continue;
    const found = candidates.find((l) => l.type === type);
    if (found) return found;
  }
  return undefined;
}

/**
 * Engine commands to enter a Realms location: ensure the scene exists, switch
 * to it, and relocate party PCs. No-op pieces are omitted by the caller when
 * already at the destination.
 */
export function buildEnterLocationCommands(
  location: CampaignStartingLocation,
  state: WorldState,
): Command[] {
  const sceneId = sceneIdForRealmEntity(location.entityId);
  const map = mapForType(location.type);
  const commands: Command[] = [];
  const scenes = state.scenes ?? {};

  if (!scenes[sceneId]) {
    commands.push({
      type: "create_scene",
      scene: buildExplorationScene(sceneId, location, map),
    });
  }

  commands.push({ type: "change_scene", sceneId });

  const partyEntities = Object.values(state.entities).filter(
    (e) => e.kind === "character" && !e.id.startsWith("npc:"),
  );
  partyEntities.forEach((entity, i) => {
    commands.push({
      type: "relocate_entity",
      entity: entity.id,
      sceneId,
      position: EXPLORATION_STARTS[i] ?? EXPLORATION_STARTS[0]!,
    });
  });

  return commands;
}

/** Ambient NPC to place on an exploration map (Rung 4 Slice 3). */
export type LocationNpcSpec = {
  entityId: string;
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
};

const NPC_SPOTS: readonly GridPosition[] = [
  { x: 2, y: 3 },
  { x: 7, y: 2 },
  { x: 3, y: 5 },
  { x: 8, y: 5 },
];

const DUNGEON_FOE_SPOTS: readonly GridPosition[] = [
  { x: 9, y: 2 },
  { x: 10, y: 4 },
  { x: 9, y: 7 },
  { x: 10, y: 6 },
];

export function realmNpcEntityId(realmEntityId: string): string {
  return `npc:realm:${realmEntityId}`;
}

/** Place World-tab NPC tokens on the current scene (skips ids already present). */
export function buildLocationNpcCommands(
  sceneId: string,
  npcs: readonly LocationNpcSpec[],
  state: WorldState,
): Command[] {
  const commands: Command[] = [];
  let slot = 0;
  for (const npc of npcs) {
    if (slot >= NPC_SPOTS.length) break;
    const id = realmNpcEntityId(npc.entityId);
    if (state.entities[id]) continue;
    commands.push({
      type: "create_entity",
      entity: {
        id,
        kind: "npc",
        name: npc.name,
        abilityScores: npc.abilityScores,
        maxHp: npc.maxHp,
        baseAc: npc.baseAc,
        speed: npc.speed,
        sceneId,
        position: NPC_SPOTS[slot]!,
      },
    });
    slot += 1;
  }
  return commands;
}

/** First authored room on a dungeon entity (GENR-5 room promotion). */
export function firstDungeonRoom(
  data: unknown,
): { name: string; encounter: string } | undefined {
  return dungeonRoomAt(data, 0);
}

/** Resolve dungeon foes for a specific room index (defaults to entry room). */
export function resolveDungeonFoesForRoom(
  dungeonEntityId: string,
  data: unknown,
  roomIndex = 0,
): FoeSpec[] {
  let resolved =
    resolveRoomEncounterTemplate(data, roomIndex) ??
    (roomIndex === 0 ? resolveWanderingMonsterTemplate(data) : undefined) ?? {
      template: "skeleton",
      count: 2,
    };
  const expanded = expandEncounterFoes(
    [{ template: resolved.template, count: resolved.count }],
    monsterTemplate,
  );
  return expanded.map((foe, i) => ({
    ...foe,
    id: `npc:dungeon:${dungeonEntityId.slice(0, 8)}:r${roomIndex}:${i}`,
    ...(i === 0 && roomIndex === 0
      ? { coatedPoisonSlug: "srd-2024_serpent-venom" }
      : {}),
  }));
}

/** @deprecated Use {@link resolveDungeonFoesForRoom}. */
export function resolveDungeonFoes(
  dungeonEntityId: string,
  data: unknown,
): FoeSpec[] {
  return resolveDungeonFoesForRoom(dungeonEntityId, data, 0);
}

function buildDungeonZoneCombatCommands(
  dungeonEntityId: string,
  floorIndex: number,
  zoneId: string,
  partyIds: readonly string[],
  foes: readonly FoeSpec[],
  entityData?: unknown,
): Command[] {
  const floors = loadDungeonFloors(entityData);
  const floor = floorByIndex(buildLayoutState(floors), floorIndex);
  const zone = floor?.zones.find((z) => z.zoneId === zoneId);
  const sceneId = sceneIdForDungeonFloor(dungeonEntityId, floorIndex);
  const foeCells = zone
    ? cellsForEntitySpawn(zone, foes.length)
    : DUNGEON_FOE_SPOTS;

  const commands: Command[] = [];
  for (const [i, foe] of foes.entries()) {
    commands.push({
      type: "create_entity",
      entity: {
        id: foe.id,
        kind: "monster",
        name: foe.name,
        abilityScores: foe.abilityScores,
        maxHp: foe.maxHp,
        baseAc: foe.baseAc,
        speed: foe.speed,
        sceneId,
        position: foeCells[i] ?? foeCells[0]!,
        ...(foe.attacksPerAction !== undefined
          ? { attacksPerAction: foe.attacksPerAction }
          : {}),
        ...(foe.coatedPoisonSlug ? { coatedPoisonSlug: foe.coatedPoisonSlug } : {}),
      },
    });
  }

  commands.push({
    type: "start_zone_encounter",
    dungeonEntityId,
    floorIndex,
    zoneId,
  });
  commands.push({ type: "roll_initiative" });
  return commands;
}

/**
 * Enter a dungeon and immediately start combat with preset foes (Rung 4 Slice 3).
 * Assumes party character entities already exist in engine state.
 */
function buildDungeonCombatCommands(
  sceneId: string,
  partyIds: readonly string[],
  foes: readonly FoeSpec[],
  dungeonEntityId?: string,
  floorIndex?: number,
  zoneId?: string,
  entityData?: unknown,
): Command[] {
  if (
    dungeonEntityId !== undefined &&
    floorIndex !== undefined &&
    zoneId !== undefined
  ) {
    return buildDungeonZoneCombatCommands(
      dungeonEntityId,
      floorIndex,
      zoneId,
      partyIds,
      foes,
      entityData,
    );
  }

  const commands: Command[] = [];
  const sides: Record<EntityRef, string> = {};
  for (const id of partyIds) sides[id] = FIXTURE_BATTLE_PARTY_SIDE;
  for (const f of foes) sides[f.id] = FIXTURE_BATTLE_FOES_SIDE;

  for (const [i, foe] of foes.entries()) {
    commands.push({
      type: "create_entity",
      entity: {
        id: foe.id,
        kind: "monster",
        name: foe.name,
        abilityScores: foe.abilityScores,
        maxHp: foe.maxHp,
        baseAc: foe.baseAc,
        speed: foe.speed,
        sceneId,
        position: DUNGEON_FOE_SPOTS[i] ?? DUNGEON_FOE_SPOTS[0]!,
        ...(foe.attacksPerAction !== undefined
          ? { attacksPerAction: foe.attacksPerAction }
          : {}),
        ...(foe.coatedPoisonSlug ? { coatedPoisonSlug: foe.coatedPoisonSlug } : {}),
      },
    });
  }

  commands.push({
    type: "start_encounter",
    sceneId,
    combatants: [...partyIds, ...foes.map((f) => f.id)],
    sides,
  });
  commands.push({ type: "roll_initiative" });
  return commands;
}

/** Combat tail for a fresh campaign seed at a dungeon starting location. */
export function buildDungeonCombatStartCommands(
  location: CampaignStartingLocation,
  partyIds: readonly string[],
  foes: readonly FoeSpec[],
): Command[] {
  return buildDungeonCombatCommands(
    sceneIdForRealmEntity(location.entityId),
    partyIds,
    foes,
  );
}

export function buildDungeonEntryCommands(
  location: CampaignStartingLocation,
  state: WorldState,
  foes: readonly FoeSpec[],
  entityData?: unknown,
): Command[] {
  const partyIds = Object.values(state.entities)
    .filter((e) => e.kind === "character" && !e.id.startsWith("npc:"))
    .map((e) => e.id);
  const room = dungeonRoomAt(entityData, 0);
  const zoneName = room?.name ?? "Entry";
  const floorIndex = room?.floorIndex ?? 0;
  const entryZoneId = zoneIdForRoomIndex(0);
  const sceneId = sceneIdForDungeonFloor(location.entityId, floorIndex);
  return [
    {
      type: "enter_dungeon",
      dungeonEntityId: location.entityId,
      floorIndex,
      entryZoneId,
      zoneName,
      locationName: location.name,
      entityData,
    },
    ...buildDungeonCombatCommands(
      sceneId,
      partyIds,
      foes,
      location.entityId,
      floorIndex,
      entryZoneId,
      entityData,
    ),
  ];
}

/**
 * Build the ordered command list for an out-of-combat opening scene: create the
 * Realms location, switch to it, and place the party — no `start_encounter`.
 */
export function buildCampaignExplorationCommands(
  party: readonly PartyMember[],
  location: CampaignStartingLocation,
): Command[] {
  const members = party.slice(0, MAX_BATTLE_PARTY);
  const sceneId = sceneIdForRealmEntity(location.entityId);
  const map = mapForType(location.type);

  return [
    {
      type: "create_scene",
      scene: buildExplorationScene(sceneId, location, map),
    },
    { type: "change_scene", sceneId },
    ...members.map(
      (m, i): Command => ({
        type: "create_entity",
        entity: {
          id: m.id,
          kind: "character",
          name: m.name,
          abilityScores: m.abilityScores,
          maxHp: m.maxHp,
          baseAc: m.baseAc,
          speed: m.speed,
          classes: m.classes,
          sceneId,
          position: EXPLORATION_STARTS[i]!,
          ...(m.spellcasting ? { spellcasting: m.spellcasting } : {}),
          ...(m.meleeReachFt !== undefined ? { meleeReachFt: m.meleeReachFt } : {}),
        },
      }),
    ),
  ];
}
