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

/* -------------------------------------------------------------------------- *
 *  Descriptor-driven types (everything except NPC)
 *
 *  The seven non-NPC types are descriptive rather than mechanical, so instead
 *  of bespoke forms each one declares a list of fields here. The generic
 *  create/edit form renders from these, the detail view reads from them, and
 *  the tRPC layer derives its per-type zod `data` schema from the same list —
 *  one source of truth for the shape.
 * -------------------------------------------------------------------------- */

export type RealmFieldKind = "text" | "textarea" | "number" | "select";

export type RealmFieldDescriptor = {
  key: string;
  label: string;
  kind: RealmFieldKind;
  placeholder?: string;
  /** Allowed values for `select` (first is the default). */
  options?: readonly string[];
  /** Max string length (text/textarea) or max value (number). */
  max?: number;
  /** Min value (number). */
  min?: number;
};

/** Per-type descriptive fields. NPC is mechanical and handled separately. */
export const REALM_FIELDS: Record<
  Exclude<RealmEntityType, "npc">,
  readonly RealmFieldDescriptor[]
> = {
  region: [
    { key: "terrain", label: "Terrain", kind: "text", placeholder: "Forests, mountains…" },
    { key: "climate", label: "Climate", kind: "text", placeholder: "Temperate, arctic…" },
    { key: "features", label: "Notable Features", kind: "textarea", placeholder: "Landmarks, dangers, resources…" },
  ],
  settlement: [
    { key: "size", label: "Size", kind: "select", options: ["Hamlet", "Village", "Town", "City", "Metropolis"] },
    { key: "population", label: "Population", kind: "number", min: 0, max: 100_000_000 },
    { key: "government", label: "Government", kind: "text", placeholder: "Council, monarchy…" },
    { key: "notes", label: "Notes", kind: "textarea" },
  ],
  building: [
    { key: "kind", label: "Kind", kind: "text", placeholder: "Temple, keep, manor…" },
    { key: "occupants", label: "Occupants", kind: "textarea" },
    { key: "notes", label: "Notes", kind: "textarea" },
  ],
  tavern: [
    { key: "proprietor", label: "Proprietor", kind: "text" },
    { key: "specialty", label: "Specialty", kind: "text", placeholder: "Signature drink or dish" },
    { key: "atmosphere", label: "Atmosphere", kind: "text", placeholder: "Rowdy, cozy…" },
    { key: "notes", label: "Notes", kind: "textarea" },
  ],
  shop: [
    { key: "kind", label: "Kind", kind: "text", placeholder: "Smithy, apothecary…" },
    { key: "proprietor", label: "Proprietor", kind: "text" },
    { key: "wares", label: "Notable Wares", kind: "textarea" },
    { key: "priceLevel", label: "Price Level", kind: "select", options: ["Cheap", "Modest", "Expensive", "Luxury"] },
  ],
  dungeon: [
    { key: "kind", label: "Kind", kind: "text", placeholder: "Crypt, cavern, ruin…" },
    { key: "depth", label: "Levels / Depth", kind: "number", min: 0, max: 1000 },
    { key: "threat", label: "Threat", kind: "select", options: ["Low", "Moderate", "Deadly"] },
    { key: "hook", label: "Hook", kind: "textarea", placeholder: "Why would the party come here?" },
  ],
  faction: [
    { key: "kind", label: "Kind", kind: "text", placeholder: "Guild, cult, kingdom…" },
    { key: "leadership", label: "Leadership", kind: "text" },
    { key: "goals", label: "Goals", kind: "textarea" },
    { key: "influence", label: "Influence", kind: "select", options: ["Local", "Regional", "National", "Continental"] },
  ],
};

/** A blank `data` payload for a type, suitable for seeding a create form. */
export function emptyDataFor(type: RealmEntityType): Record<string, unknown> {
  if (type === "npc") return emptyNpcData() as unknown as Record<string, unknown>;
  const data: Record<string, string | number> = {};
  for (const field of REALM_FIELDS[type]) {
    if (field.kind === "number") data[field.key] = field.min ?? 0;
    else if (field.kind === "select") data[field.key] = field.options?.[0] ?? "";
    else data[field.key] = "";
  }
  return data;
}

/* -------------------------------------------------------------------------- *
 *  Relationships
 * -------------------------------------------------------------------------- */

/** Directed relationship kinds (mirrors the `realm_relationships.kind` column). */
export const REALM_RELATIONSHIP_KINDS = [
  "located_in",
  "member_of",
  "owns",
  "rules",
  "allied_with",
  "rival_of",
  "related_to",
] as const;

export type RealmRelationshipKind = (typeof REALM_RELATIONSHIP_KINDS)[number];

/** Label from the source entity's perspective (`from → to`). */
export const REL_LABEL: Record<RealmRelationshipKind, string> = {
  located_in: "Located in",
  member_of: "Member of",
  owns: "Owns",
  rules: "Rules",
  allied_with: "Allied with",
  rival_of: "Rival of",
  related_to: "Related to",
};

/** Label from the target entity's perspective (`to ← from`). */
export const REL_INVERSE_LABEL: Record<RealmRelationshipKind, string> = {
  located_in: "Contains",
  member_of: "Has member",
  owns: "Owned by",
  rules: "Ruled by",
  allied_with: "Allied with",
  rival_of: "Rival of",
  related_to: "Related to",
};
