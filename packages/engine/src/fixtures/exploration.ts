/**
 * Campaign exploration bootstrap (Rung 4) — seed Live Play with a Realms location
 * scene + party tokens, **without** starting combat. Mirrors the tutorial's
 * arrival scenes (`create_scene` → `change_scene` → place PCs); combat only
 * begins when fiction requires it (armed encounter, Run Now, or in-fiction trigger).
 */
import type { Command } from "../commands/types";
import type { GridPosition } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { MAX_BATTLE_PARTY, type PartyMember } from "./battle";

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

/** Reverse {@link sceneIdForRealmEntity} for Realms-backed scenes. */
export function entityIdFromSceneId(sceneId: string | undefined): string | undefined {
  if (!sceneId) return undefined;
  if (sceneId === "scene:travelers-rest") return "generic";
  const prefix = "scene:realm:";
  if (sceneId.startsWith(prefix)) return sceneId.slice(prefix.length);
  return undefined;
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

function mapForType(type: ExplorableRealmType): ExplorationMapDef {
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

/**
 * Canned opening GM line for a fresh campaign load (LLM-free; the orchestrator
 * may replace it on the player's first message when configured).
 */
export function openingNarrationForLocation(loc: CampaignStartingLocation): {
  text: string;
  mentions: string[];
} {
  const blurb = loc.summary.trim() || defaultBlurb(loc.type);
  return {
    text: `You arrive at ${loc.name}. ${blurb} What do you do?`,
    mentions: [loc.name],
  };
}

/** GM line after the party travels to a new Realms location (Rung 4 Slice 2). */
export function arrivalNarrationForLocation(loc: CampaignStartingLocation): {
  text: string;
  mentions: string[];
} {
  const blurb = loc.summary.trim() || defaultBlurb(loc.type);
  return {
    text: `You make your way to ${loc.name}. ${blurb}`,
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
      scene: {
        id: sceneId,
        name: location.name,
        description: map.description,
        map: {
          width: map.width,
          height: map.height,
          blockedCells: map.blockedCells,
        },
      },
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
      scene: {
        id: sceneId,
        name: location.name,
        description: map.description,
        map: {
          width: map.width,
          height: map.height,
          blockedCells: map.blockedCells,
        },
      },
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
