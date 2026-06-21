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

/**
 * Types whose generator emits child stubs and so support cascading generation
 * (Realms generator pipeline, D6). Browser-safe so the generate form and the
 * server orchestrator share one definition.
 */
export const CASCADE_PARENT_TYPES: readonly RealmEntityType[] = [
  "region",
  "settlement",
];

export function isCascadeParent(type: RealmEntityType): boolean {
  return CASCADE_PARENT_TYPES.includes(type);
}

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

/**
 * Scalar field kinds plus two rich kinds:
 * - `list`  — an array of strings (e.g. rumors, key laws).
 * - `group` — an array of small objects with their own scalar sub-fields
 *             (e.g. notable locations `[{ name, description }]`).
 *
 * The same descriptors drive the form, the tabbed detail view, the zod `data`
 * validator, and the generator's tool schema + prompt — one source of truth so a
 * new rich type is authored by writing descriptors, not bespoke code (GEN-1).
 */
export type RealmFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "list"
  | "group";

/** Scalar kinds allowed inside a `group` item's sub-fields. */
export type RealmSubFieldKind = "text" | "textarea" | "number" | "select";

export type RealmSubFieldDescriptor = {
  key: string;
  label: string;
  kind: RealmSubFieldKind;
  placeholder?: string;
  options?: readonly string[];
  max?: number;
  min?: number;
};

export type RealmFieldDescriptor = {
  key: string;
  label: string;
  kind: RealmFieldKind;
  /** Tab/section this field belongs to (detail view + form). Default `Details`. */
  section?: string;
  placeholder?: string;
  /** Allowed values for `select` (first is the default). */
  options?: readonly string[];
  /** Max string length (text/textarea/list item) or max value (number). */
  max?: number;
  /** Min value (number). */
  min?: number;
  /** Singular label for the add-row button on `list`/`group`. */
  itemLabel?: string;
  /** Sub-fields for a `group` item. */
  fields?: readonly RealmSubFieldDescriptor[];
};

/** The default section name for descriptors that don't declare one. */
export const DEFAULT_SECTION = "Details";

/** A section (tab) and the descriptors it contains, in declaration order. */
export type RealmSection = {
  name: string;
  fields: readonly RealmFieldDescriptor[];
};

/**
 * Group a type's descriptors into ordered sections (tabs). Sections appear in
 * first-seen order; fields keep their declaration order within a section.
 */
export function realmSections(
  type: Exclude<RealmEntityType, "npc">,
): RealmSection[] {
  const order: string[] = [];
  const byName = new Map<string, RealmFieldDescriptor[]>();
  for (const field of REALM_FIELDS[type]) {
    const name = field.section ?? DEFAULT_SECTION;
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    byName.get(name)!.push(field);
  }
  return order.map((name) => ({ name, fields: byName.get(name)! }));
}

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
  // Settlement is the rich pilot type (GEN-1): sectioned into tabs, with `list`
  // and `group` fields. Keeps the original thin keys (size/population/
  // government/notes) so existing settlements remain valid.
  settlement: [
    // —— Overview ——
    { key: "size", label: "Size", kind: "select", section: "Overview", options: ["Hamlet", "Village", "Town", "City", "Metropolis"] },
    { key: "population", label: "Population", kind: "number", section: "Overview", min: 0, max: 100_000_000 },
    { key: "wealth", label: "Wealth", kind: "select", section: "Overview", options: ["Destitute", "Poor", "Modest", "Comfortable", "Wealthy", "Opulent"] },
    { key: "government", label: "Government", kind: "text", section: "Overview", placeholder: "Council, monarchy…" },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "A paragraph capturing the feel of the place…" },
    // —— Geography & Defenses ——
    { key: "location", label: "Location", kind: "text", section: "Geography & Defenses", placeholder: "Crossroads, coastal, mountain pass…" },
    { key: "terrain", label: "Terrain", kind: "text", section: "Geography & Defenses", placeholder: "Surrounding land" },
    { key: "climate", label: "Climate", kind: "text", section: "Geography & Defenses", placeholder: "Temperate, arid…" },
    { key: "defenses", label: "Defenses", kind: "textarea", section: "Geography & Defenses", placeholder: "Walls, garrison, readiness…" },
    { key: "districts", label: "Districts", kind: "list", section: "Geography & Defenses", itemLabel: "District", placeholder: "The Gate Quarter" },
    // —— Society & Economy ——
    { key: "demographics", label: "Demographics", kind: "textarea", section: "Society & Economy", placeholder: "Peoples and their proportions" },
    { key: "culture", label: "Culture", kind: "textarea", section: "Society & Economy", placeholder: "Customs, religion, festivals…" },
    { key: "economy", label: "Economy", kind: "textarea", section: "Society & Economy", placeholder: "Trade, industry, resources" },
    // —— Notable Places ——
    {
      key: "notableLocations",
      label: "Notable Locations",
      kind: "group",
      section: "Notable Places",
      itemLabel: "Location",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Iron Gate Inn" },
        { key: "kind", label: "Kind", kind: "text", placeholder: "Tavern, temple, market…" },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    // —— People & Secrets ——
    {
      key: "notableFigures",
      label: "Notable Figures",
      kind: "group",
      section: "People & Secrets",
      itemLabel: "Figure",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Captain Vane" },
        { key: "role", label: "Role", kind: "text", placeholder: "Captain of the Guard" },
      ],
    },
    { key: "rumors", label: "Rumors", kind: "list", section: "People & Secrets", itemLabel: "Rumor", placeholder: "A whisper heard in the streets" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "People & Secrets", itemLabel: "Hook", placeholder: "Why might adventurers come here?" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "People & Secrets", placeholder: "Hidden truths (DM-only in campaigns)" },
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
  const data: Record<string, unknown> = {};
  for (const field of REALM_FIELDS[type]) {
    if (field.kind === "number") data[field.key] = field.min ?? 0;
    else if (field.kind === "select") data[field.key] = field.options?.[0] ?? "";
    else if (field.kind === "list" || field.kind === "group") data[field.key] = [];
    else data[field.key] = "";
  }
  return data;
}

/** A blank `group` item ({} of empty sub-field values) for the form. */
export function emptyGroupItem(
  field: RealmFieldDescriptor,
): Record<string, string | number> {
  const item: Record<string, string | number> = {};
  for (const sub of field.fields ?? []) {
    if (sub.kind === "number") item[sub.key] = sub.min ?? 0;
    else if (sub.kind === "select") item[sub.key] = sub.options?.[0] ?? "";
    else item[sub.key] = "";
  }
  return item;
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

/* -------------------------------------------------------------------------- *
 *  Graph view
 * -------------------------------------------------------------------------- */

/** Node fill per type for the Graph view (tailwind-300 palette, dark-theme safe). */
export const REALM_TYPE_COLOR: Record<RealmEntityType, string> = {
  region: "#6ee7b7",
  settlement: "#fcd34d",
  building: "#93c5fd",
  tavern: "#f9a8d4",
  shop: "#c4b5fd",
  dungeon: "#fca5a5",
  faction: "#fdba74",
  npc: "#67e8f9",
};

export type GraphLayoutNode = { id: string };
export type GraphLayoutEdge = { source: string; target: string };
export type Point = { x: number; y: number };

export type GraphLayoutOptions = {
  width?: number;
  height?: number;
  iterations?: number;
};

/**
 * Deterministic force-directed layout (Fruchterman–Reingold). Pure and
 * seedless — initial positions are placed on a ring by index and the simulation
 * runs a fixed number of iterations — so the same graph always lays out the
 * same way and the result is unit-testable. No external dependency; the caller
 * renders the returned positions however it likes (SVG here).
 */
export function layoutGraph(
  nodes: readonly GraphLayoutNode[],
  edges: readonly GraphLayoutEdge[],
  options?: GraphLayoutOptions,
): Record<string, Point> {
  const width = options?.width ?? 1000;
  const height = options?.height ?? 1000;
  const iterations = options?.iterations ?? 300;
  const n = nodes.length;
  const result: Record<string, Point> = {};
  if (n === 0) return result;
  if (n === 1) {
    result[nodes[0]!.id] = { x: width / 2, y: height / 2 };
    return result;
  }

  const k = Math.sqrt((width * height) / n); // ideal edge length
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const pos = nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      x: width / 2 + (Math.cos(angle) * width) / 4,
      y: height / 2 + (Math.sin(angle) * height) / 4,
    };
  });
  const validEdges = edges.filter(
    (e) =>
      e.source !== e.target && index.has(e.source) && index.has(e.target),
  );

  let temperature = width / 10;
  const cooldown = temperature / (iterations + 1);

  for (let iter = 0; iter < iterations; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion between every pair of nodes.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i]!.x - pos[j]!.x;
        const dy = pos[i]!.y - pos[j]!.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        disp[i]!.x += ux * force;
        disp[i]!.y += uy * force;
        disp[j]!.x -= ux * force;
        disp[j]!.y -= uy * force;
      }
    }

    // Attraction along edges.
    for (const edge of validEdges) {
      const i = index.get(edge.source)!;
      const j = index.get(edge.target)!;
      const dx = pos[i]!.x - pos[j]!.x;
      const dy = pos[i]!.y - pos[j]!.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      const ux = dx / dist;
      const uy = dy / dist;
      disp[i]!.x -= ux * force;
      disp[i]!.y -= uy * force;
      disp[j]!.x += ux * force;
      disp[j]!.y += uy * force;
    }

    // Displace, capped by the cooling temperature, and clamp into the box.
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(disp[i]!.x, disp[i]!.y) || 0.01;
      const limited = Math.min(d, temperature);
      pos[i]!.x = Math.min(width, Math.max(0, pos[i]!.x + (disp[i]!.x / d) * limited));
      pos[i]!.y = Math.min(height, Math.max(0, pos[i]!.y + (disp[i]!.y / d) * limited));
    }

    temperature = Math.max(0, temperature - cooldown);
  }

  nodes.forEach((node, i) => {
    result[node.id] = pos[i]!;
  });
  return result;
}
