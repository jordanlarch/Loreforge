/**
 * Browser-safe Realms taxonomy + presentation helpers (#41).
 *
 * The canonical list of the eight entity types, their display labels, and the
 * adapter that feeds an NPC row's stored data into the engine's
 * `buildCharacterSheet`. Lives here (not in `@app/db`) so client components can
 * import it without pulling server-only Postgres code into the bundle. The DB
 * schema mirrors this list as a structural column type; the tRPC layer owns the
 * per-type zod validation.
 */
import type {
  Ability,
  AbilityScores,
  CharacterSheetInput,
  ClassLevel,
} from "@app/engine";

/** The eight Realms entity types (`docs/ui-flows/realms-library.md`). */
export const REALM_ENTITY_TYPES = [
  "region",
  "settlement",
  "building",
  "tavern",
  "shop",
  "dungeon",
  "faction",
  "npc",
] as const;

export type RealmEntityType = (typeof REALM_ENTITY_TYPES)[number];

/** Singular display label for a type (detail header, card subtitle). */
export const REALM_TYPE_LABEL: Record<RealmEntityType, string> = {
  region: "Region",
  settlement: "Settlement",
  building: "Building",
  tavern: "Tavern",
  shop: "Shop",
  dungeon: "Dungeon",
  faction: "Faction",
  npc: "NPC",
};

/** Plural display label for a type (sidebar). */
export const REALM_TYPE_LABEL_PLURAL: Record<RealmEntityType, string> = {
  region: "Regions",
  settlement: "Settlements",
  building: "Buildings",
  tavern: "Taverns",
  shop: "Shops",
  dungeon: "Dungeons",
  faction: "Factions",
  npc: "NPCs",
};

/**
 * Type-specific payload for an NPC entity, stored in `realm_entities.data`.
 * Mirrors the character primitives so the stat block derives mods / proficiency
 * / saves through `@app/engine` — never in the UI.
 */
export type NpcData = {
  species: string;
  /** Free-text role/occupation, e.g. "Blacksmith" (the sheet's "background"). */
  role: string;
  alignment: string;
  classes: ClassLevel[];
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
  saveProficiencies: Ability[];
  skillProficiencies: string[];
};

export const DEFAULT_NPC_ABILITY_SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

/** A blank NPC payload for the create form. */
export function emptyNpcData(): NpcData {
  return {
    species: "",
    role: "",
    alignment: "",
    classes: [],
    abilityScores: { ...DEFAULT_NPC_ABILITY_SCORES },
    maxHp: 10,
    baseAc: 10,
    speed: 30,
    saveProficiencies: [],
    skillProficiencies: [],
  };
}

/**
 * Project an NPC entity row into the engine's character-sheet input so the
 * detail page reuses the exact same derivation as Character View. Missing/legacy
 * fields fall back to sensible defaults rather than throwing.
 */
export function npcToSheetInput(row: {
  id: string;
  name: string;
  data: Record<string, unknown>;
}): CharacterSheetInput {
  const d = row.data as Partial<NpcData>;
  return {
    id: row.id,
    name: row.name,
    species: d.species ?? "",
    background: d.role ?? "",
    classes: d.classes ?? [],
    abilityScores: d.abilityScores ?? { ...DEFAULT_NPC_ABILITY_SCORES },
    maxHp: d.maxHp ?? 1,
    baseAc: d.baseAc ?? 10,
    speed: d.speed ?? 30,
    saveProficiencies: d.saveProficiencies ?? [],
    skillProficiencies: d.skillProficiencies ?? [],
  };
}
