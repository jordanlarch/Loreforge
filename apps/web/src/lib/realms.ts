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
  "tavern",
  "shop",
  "building",
  "faction",
  "dungeon",
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
  // Region is a rich generator type (#116) and the deepest cascade: it parents
  // settlements, sites, factions, and NPCs. Sectioned into tabs with `list` and
  // `group` fields. Keeps the original thin keys (terrain/climate/features) so
  // existing regions stay valid.
  region: [
    // —— Overview ——
    { key: "regionType", label: "Type", kind: "select", section: "Overview", options: ["Kingdom", "Province", "Duchy", "Heartland", "Frontier", "Borderland", "Wilderness", "Wasteland", "Archipelago", "Untamed Expanse"] },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "government", label: "Ruling Power", kind: "text", section: "Overview", placeholder: "Crown, council, warlords, none…" },
    { key: "population", label: "Population", kind: "text", section: "Overview", placeholder: "~50,000, mostly farmfolk" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "A paragraph capturing the feel of the region…" },
    // —— Geography & Climate ——
    { key: "terrain", label: "Terrain", kind: "text", section: "Geography & Climate", placeholder: "Forests, mountains…" },
    { key: "climate", label: "Climate", kind: "text", section: "Geography & Climate", placeholder: "Temperate, arctic…" },
    { key: "geography", label: "Geography", kind: "textarea", section: "Geography & Climate", placeholder: "The lay of the land — rivers, ranges, borders…" },
    { key: "features", label: "Notable Features", kind: "textarea", section: "Geography & Climate", placeholder: "Landmarks, dangers, resources…" },
    { key: "wildlife", label: "Flora & Fauna", kind: "textarea", section: "Geography & Climate", placeholder: "Characteristic plants and creatures" },
    { key: "naturalResources", label: "Natural Resources", kind: "list", section: "Geography & Climate", itemLabel: "Resource", placeholder: "Iron ore, timber, fertile soil…" },
    { key: "landmarks", label: "Landmarks", kind: "list", section: "Geography & Climate", itemLabel: "Landmark", placeholder: "A standing stone, a great waterfall…" },
    // —— Settlements & Sites —— (the Region's signature tab: structured children)
    {
      key: "settlements",
      label: "Settlements",
      kind: "group",
      section: "Settlements & Sites",
      itemLabel: "Settlement",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Briar Hollow" },
        { key: "kind", label: "Kind", kind: "select", options: ["Hamlet", "Village", "Town", "City", "Metropolis", "Capital"] },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    {
      key: "sites",
      label: "Notable Sites",
      kind: "group",
      section: "Settlements & Sites",
      itemLabel: "Site",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Sunken Abbey" },
        { key: "kind", label: "Kind", kind: "text", placeholder: "Dungeon, ruin, temple, stronghold…" },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    // —— Powers & Conflicts ——
    {
      key: "factions",
      label: "Powers & Factions",
      kind: "group",
      section: "Powers & Conflicts",
      itemLabel: "Power",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Ashen Hand" },
        { key: "influence", label: "Influence", kind: "text", placeholder: "Dominant, rising, waning…" },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    { key: "politics", label: "Politics", kind: "textarea", section: "Powers & Conflicts", placeholder: "Who holds power, and how it is contested" },
    { key: "conflicts", label: "Conflicts & Tensions", kind: "textarea", section: "Powers & Conflicts", placeholder: "Wars, feuds, simmering grievances…" },
    { key: "threats", label: "Threats", kind: "list", section: "Powers & Conflicts", itemLabel: "Threat", placeholder: "A monster, raider band, or looming danger" },
    // —— Lore & Hooks ——
    { key: "history", label: "History", kind: "textarea", section: "Lore & Hooks", placeholder: "How the region came to be what it is" },
    { key: "culture", label: "Culture & Peoples", kind: "textarea", section: "Lore & Hooks", placeholder: "Customs, faiths, languages, festivals…" },
    { key: "legends", label: "Legends", kind: "list", section: "Lore & Hooks", itemLabel: "Legend", placeholder: "A myth or tale told here" },
    { key: "rumors", label: "Rumors", kind: "list", section: "Lore & Hooks", itemLabel: "Rumor", placeholder: "A whisper carried on the roads" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Lore & Hooks", itemLabel: "Hook", placeholder: "Why might adventurers come here?" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "Lore & Hooks", placeholder: "Hidden truths (DM-only in campaigns)" },
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
    // —— Government ——
    { key: "ruler", label: "Ruler / Mayor", kind: "text", section: "Government", placeholder: "Who holds executive power" },
    { key: "council", label: "Council / Court", kind: "textarea", section: "Government", placeholder: "Governing body, advisors, succession…" },
    { key: "laws", label: "Notable Laws", kind: "list", section: "Government", itemLabel: "Law", placeholder: "Curfew, trade restrictions…" },
    // —— History ——
    { key: "founding", label: "Founding", kind: "textarea", section: "History", placeholder: "How the settlement began" },
    { key: "history", label: "History", kind: "textarea", section: "History", placeholder: "Major eras and turning points" },
    { key: "recentEvents", label: "Recent Events", kind: "list", section: "History", itemLabel: "Event", placeholder: "Something that happened lately" },
    // —— Law & Order ——
    { key: "lawEnforcement", label: "Law Enforcement", kind: "textarea", section: "Law & Order", placeholder: "Guard, watch, militia…" },
    { key: "crimeLevel", label: "Crime Level", kind: "select", section: "Law & Order", options: ["Negligible", "Low", "Moderate", "High", "Rampant"] },
    { key: "punishment", label: "Justice & Punishment", kind: "textarea", section: "Law & Order", placeholder: "Trials, prisons, exile…" },
    // —— Culture ——
    { key: "religion", label: "Religion & Temples", kind: "textarea", section: "Culture", placeholder: "Faiths, shrines, holy days" },
    { key: "festivals", label: "Festivals", kind: "list", section: "Culture", itemLabel: "Festival", placeholder: "Harvest fair, solstice rite…" },
    { key: "customs", label: "Customs & Taboos", kind: "textarea", section: "Culture", placeholder: "Greetings, dress codes, superstitions" },
    // —— Economy (detail) ——
    { key: "tradeGoods", label: "Trade Goods", kind: "list", section: "Economy", itemLabel: "Good", placeholder: "Iron ingots, wool, spices…" },
    { key: "taxes", label: "Taxes & Tariffs", kind: "textarea", section: "Economy", placeholder: "Gate tolls, market fees…" },
    {
      key: "districtDetails",
      label: "District Details",
      kind: "group",
      section: "Districts",
      itemLabel: "District",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Dockside" },
        { key: "population", label: "Population", kind: "number", min: 0 },
        { key: "character", label: "Character", kind: "textarea", placeholder: "Who lives here and what it feels like" },
        { key: "notable", label: "Notable Feature", kind: "text", placeholder: "Landmark or hook" },
      ],
    },
    { key: "demographics", label: "Demographics", kind: "textarea", section: "Society & Economy", placeholder: "Peoples and their proportions" },
    { key: "culture", label: "Culture", kind: "textarea", section: "Society & Economy", placeholder: "Customs, religion, festivals…" },
    { key: "economy", label: "Economy", kind: "textarea", section: "Society & Economy", placeholder: "Trade, industry, resources" },
    // —— Society & Economy ——
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
  // Building is a rich generator type (#66): sectioned tabs with architecture,
  // history, and feature/secret lists, plus owner/occupant NPC cascade. Keeps
  // the original thin keys (kind/occupants/notes) so existing buildings stay
  // valid — `kind` stays free text rather than a select for the same reason.
  building: [
    // —— Overview ——
    { key: "kind", label: "Type", kind: "text", section: "Overview", placeholder: "Temple, library, bazaar, manor…" },
    { key: "condition", label: "Condition", kind: "select", section: "Overview", options: ["Pristine", "Well-Maintained", "Worn", "Damaged", "Ruined", "Haunted", "Sealed", "Active", "Abandoned"] },
    { key: "size", label: "Size", kind: "select", section: "Overview", options: ["Tiny", "Small", "Medium", "Large", "Huge", "Vast"] },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "occupants", label: "Occupants", kind: "textarea", section: "Overview", placeholder: "Who works, lives, or lingers here" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "What the building looks and feels like…" },
    // —— Architecture ——
    { key: "architecturalStyle", label: "Architectural Style", kind: "text", section: "Architecture", placeholder: "Gothic industrialism, sun-bleached adobe…" },
    { key: "atmosphere", label: "Atmosphere", kind: "textarea", section: "Architecture", placeholder: "The mood and sensory feel inside" },
    { key: "materials", label: "Materials", kind: "list", section: "Architecture", itemLabel: "Material", placeholder: "Granite, wrought iron…" },
    { key: "features", label: "Notable Features", kind: "list", section: "Architecture", itemLabel: "Feature", placeholder: "A landmark detail" },
    { key: "hiddenFeatures", label: "Hidden Features", kind: "list", section: "Architecture", itemLabel: "Hidden Feature", placeholder: "A secret passage, sub-basement…" },
    // —— History ——
    { key: "history", label: "History", kind: "textarea", section: "History", placeholder: "How the building came to be what it is" },
    { key: "originEvent", label: "Origin Event", kind: "text", section: "History", placeholder: "The Great Fire of 30 years ago" },
    // —— Lore & Secrets ——
    { key: "rumors", label: "Rumors", kind: "list", section: "Lore & Secrets", itemLabel: "Rumor", placeholder: "A rumor overheard about this place" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Lore & Secrets", itemLabel: "Hook", placeholder: "An adventure seed" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "Lore & Secrets", placeholder: "Hidden truths (DM-only in campaigns)" },
  ],
  // Tavern is a rich generator type (#64): sectioned tabs with menu/patron/
  // amenity groups + rumor/quirk/hook lists. Keeps the original thin keys
  // (proprietor/specialty/atmosphere/notes) so existing taverns stay valid.
  tavern: [
    // —— Overview ——
    { key: "type", label: "Type", kind: "select", section: "Overview", options: ["Cozy Inn", "Rowdy Tavern", "Noble's Rest", "Adventurer's Haven", "Dockside Pub", "Mountain Lodge", "Hidden Speakeasy", "Roadside Inn", "Mystic Lounge"] },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "proprietor", label: "Proprietor", kind: "text", section: "Overview", placeholder: "The keeper's name" },
    { key: "specialty", label: "Specialty", kind: "text", section: "Overview", placeholder: "Signature drink or dish" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "What the place looks and feels like…" },
    // —— Atmosphere ——
    { key: "crowdLevel", label: "Crowd Level", kind: "select", section: "Atmosphere", options: ["Empty", "Quiet", "Moderate", "Lively", "Packed"] },
    { key: "atmosphere", label: "Atmosphere", kind: "text", section: "Atmosphere", placeholder: "Rowdy, cozy…" },
    { key: "smell", label: "Smell", kind: "text", section: "Atmosphere", placeholder: "Mulled wine, woodsmoke…" },
    { key: "sound", label: "Sound", kind: "text", section: "Atmosphere", placeholder: "Low chatter, clinking pewter…" },
    { key: "lighting", label: "Lighting", kind: "text", section: "Atmosphere", placeholder: "Warm hearth-glow, dim corners…" },
    { key: "mood", label: "Mood", kind: "text", section: "Atmosphere", placeholder: "Welcoming but watchful" },
    // —— Menu ——
    {
      key: "menu",
      label: "Menu",
      kind: "group",
      section: "Menu",
      itemLabel: "Menu Item",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Hearty Venison Stew" },
        { key: "category", label: "Category", kind: "select", options: ["Food", "Drink", "Special"] },
        { key: "price", label: "Price", kind: "text", placeholder: "4 cp" },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    // —— Patrons & Amenities ——
    {
      key: "patrons",
      label: "Regular Patrons",
      kind: "group",
      section: "Patrons & Amenities",
      itemLabel: "Patron",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Thistle of the High Forest" },
        { key: "descriptor", label: "Descriptor", kind: "text", placeholder: "Wood Elf druid, always at the back table" },
      ],
    },
    {
      key: "amenities",
      label: "Amenities",
      kind: "group",
      section: "Patrons & Amenities",
      itemLabel: "Amenity",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Verdant Stable" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "cost", label: "Cost", kind: "text", placeholder: "5 sp/night" },
      ],
    },
    // —— Lore & Rumors ——
    { key: "lore", label: "Lore", kind: "textarea", section: "Lore & Rumors", placeholder: "Legends and history tied to this place…" },
    { key: "quirks", label: "Quirks", kind: "list", section: "Lore & Rumors", itemLabel: "Quirk", placeholder: "A memorable detail the GM can reference" },
    { key: "rumors", label: "Rumors", kind: "list", section: "Lore & Rumors", itemLabel: "Rumor", placeholder: "A rumor overheard here" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Lore & Rumors", itemLabel: "Hook", placeholder: "An adventure seed" },
  ],
  // Shop is a rich generator type (#65): sectioned tabs with a structured
  // inventory group (the signature feature), a loot/security section for
  // thieving parties, plus quirk/rumor/hook lists. Keeps the original thin keys
  // (kind/proprietor/wares/priceLevel) so existing shops stay valid — `kind`
  // stays free text rather than a select so legacy values don't fail the enum.
  shop: [
    // —— Overview ——
    { key: "kind", label: "Type", kind: "text", section: "Overview", placeholder: "Blacksmith, apothecary, magic shop…" },
    { key: "specialty", label: "Specialty", kind: "text", section: "Overview", placeholder: "Dwarven steel, rare reagents…" },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "proprietor", label: "Proprietor", kind: "text", section: "Overview", placeholder: "The shopkeeper's name" },
    { key: "priceLevel", label: "Pricing Tier", kind: "select", section: "Overview", options: ["Cheap", "Modest", "Expensive", "Luxury"] },
    { key: "haggling", label: "Haggling", kind: "text", section: "Overview", placeholder: "Yes, DC 15 Persuasion" },
    { key: "wares", label: "Notable Wares", kind: "textarea", section: "Overview", placeholder: "The kinds of goods openly offered" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "What the shop looks and feels like…" },
    // —— Inventory —— (the Shop's signature tab: each line is a structured item)
    {
      key: "inventory",
      label: "Inventory",
      kind: "group",
      section: "Inventory",
      itemLabel: "Item",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "Battleaxe +1" },
        { key: "itemType", label: "Type", kind: "select", options: ["Weapon", "Armor", "Potion", "Scroll", "Wondrous Item", "Consumable", "Gear", "Misc"] },
        { key: "rarity", label: "Rarity", kind: "select", options: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] },
        { key: "price", label: "Price", kind: "text", placeholder: "500 gp" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "properties", label: "Properties", kind: "textarea", placeholder: "+1 to hit & damage; 1d8 slashing; Versatile" },
      ],
    },
    // —— Quirks ——
    { key: "quirks", label: "Quirks", kind: "list", section: "Quirks", itemLabel: "Quirk", placeholder: "A memorable detail the GM can reference" },
    // —— Loot & Security —— (DM/AI material for thieving parties)
    { key: "lootOverview", label: "Loot Overview", kind: "textarea", section: "Loot & Security", placeholder: "Where valuables are kept and how they're secured" },
    { key: "securitySkill", label: "Security Skill", kind: "text", section: "Loot & Security", placeholder: "Thieves' Tools" },
    { key: "securityDc", label: "Security DC", kind: "number", section: "Loot & Security", min: 0, max: 40 },
    { key: "failureConsequence", label: "Failure Consequence", kind: "textarea", section: "Loot & Security", placeholder: "What happens on a failed heist" },
    {
      key: "lootables",
      label: "Lootable Items",
      kind: "group",
      section: "Loot & Security",
      itemLabel: "Lootable",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Ironbrand Ledger" },
        { key: "category", label: "Category", kind: "text", placeholder: "Records, Currency, Art Object…" },
        { key: "value", label: "Estimated Value", kind: "text", placeholder: "~100 gp" },
        { key: "location", label: "Location", kind: "text", placeholder: "In the stone safe" },
        { key: "description", label: "Description", kind: "textarea" },
      ],
    },
    // —— Lore & Rumors ——
    { key: "rumors", label: "Rumors", kind: "list", section: "Lore & Rumors", itemLabel: "Rumor", placeholder: "A rumor overheard about this shop" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Lore & Rumors", itemLabel: "Hook", placeholder: "An adventure seed" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "Lore & Rumors", placeholder: "Hidden truths (DM-only in campaigns)" },
  ],
  // Dungeon is a rich generator type (#68): sectioned tabs with a structured
  // rooms group (the signature feature), hazards/monster lists, and lore/secret
  // sections, plus a boss/key-NPC cascade. Keeps the original thin keys
  // (kind/depth/threat/hook) so existing dungeons stay valid — `kind` stays free
  // text and the threat options are preserved so legacy values don't fail the
  // enum.
  dungeon: [
    // —— Overview ——
    { key: "kind", label: "Type", kind: "text", section: "Overview", placeholder: "Crypt, cavern, ruin…" },
    { key: "depth", label: "Levels / Depth", kind: "number", section: "Overview", min: 0, max: 1000 },
    { key: "threat", label: "Threat", kind: "select", section: "Overview", options: ["Low", "Moderate", "Deadly"] },
    { key: "partyLevel", label: "Party Level", kind: "number", section: "Overview", min: 1, max: 20 },
    { key: "tagline", label: "Tagline", kind: "text", section: "Overview", placeholder: "A vivid one-line hook" },
    { key: "hook", label: "Hook", kind: "textarea", section: "Overview", placeholder: "Why would the party come here?" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "What the place is and how it reads…" },
    // —— Atmosphere & Lore ——
    { key: "atmosphere", label: "Atmosphere", kind: "textarea", section: "Atmosphere & Lore", placeholder: "The sights, sounds, and smells within" },
    { key: "history", label: "History", kind: "textarea", section: "Atmosphere & Lore", placeholder: "How the dungeon came to be" },
    { key: "overarchingThreat", label: "Overarching Threat", kind: "textarea", section: "Atmosphere & Lore", placeholder: "The looming danger that ties it together" },
    // —— Rooms —— (the Dungeon's signature tab: each room is a structured entry)
    {
      key: "rooms",
      label: "Rooms",
      kind: "group",
      section: "Rooms",
      itemLabel: "Room",
      fields: [
        { key: "name", label: "Name", kind: "text", placeholder: "The Threshold of Tears" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "encounter", label: "Encounter", kind: "text", placeholder: "Monsters, trap, or puzzle here" },
        { key: "treasure", label: "Treasure", kind: "text", placeholder: "What can be found here" },
      ],
    },
    // —— Hazards & Monsters ——
    { key: "wanderingMonsters", label: "Wandering Monsters", kind: "list", section: "Hazards & Monsters", itemLabel: "Monster", placeholder: "A creature that roams the halls" },
    { key: "hazards", label: "Hazards", kind: "list", section: "Hazards & Monsters", itemLabel: "Hazard", placeholder: "A trap or environmental danger" },
    // —— Secrets & Hooks ——
    { key: "rumors", label: "Rumors", kind: "list", section: "Secrets & Hooks", itemLabel: "Rumor", placeholder: "A rumor heard about this place" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Secrets & Hooks", itemLabel: "Hook", placeholder: "An adventure seed" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "Secrets & Hooks", placeholder: "Hidden truths (DM-only in campaigns)" },
  ],
  // Faction is a rich generator type (#67): sectioned tabs covering identity,
  // goals/methods, organization, relationships, and lore/secrets, plus a
  // leader/key-member NPC cascade and ally/rival lists that complement the
  // relationship graph. Keeps the original thin keys (kind/leadership/goals/
  // influence) so existing factions stay valid — `kind` stays free text and the
  // influence options are preserved so legacy values don't fail the enum.
  faction: [
    // —— Overview ——
    { key: "kind", label: "Type", kind: "text", section: "Overview", placeholder: "Thieves' guild, cult, knightly order…" },
    { key: "alignment", label: "Alignment", kind: "text", section: "Overview", placeholder: "True Neutral, Lawful Evil…" },
    { key: "size", label: "Size", kind: "text", section: "Overview", placeholder: "Large (201-1000 members)" },
    { key: "influence", label: "Influence", kind: "select", section: "Overview", options: ["Local", "Regional", "National", "Continental"] },
    { key: "leadership", label: "Leadership", kind: "text", section: "Overview", placeholder: "Who leads, and how" },
    { key: "motto", label: "Motto", kind: "text", section: "Overview", placeholder: "A creed members live by" },
    { key: "notes", label: "Description", kind: "textarea", section: "Overview", placeholder: "What the faction is and what it's known for…" },
    // —— Goals & Methods ——
    { key: "goals", label: "Goals", kind: "textarea", section: "Goals & Methods", placeholder: "What the faction is trying to achieve" },
    { key: "methods", label: "Methods", kind: "list", section: "Goals & Methods", itemLabel: "Method", placeholder: "How they pursue their goals" },
    { key: "services", label: "Services", kind: "list", section: "Goals & Methods", itemLabel: "Service", placeholder: "What they offer members or clients" },
    // —— Organization ——
    { key: "headquarters", label: "Headquarters", kind: "text", section: "Organization", placeholder: "Seat of power" },
    { key: "hierarchy", label: "Hierarchy", kind: "list", section: "Organization", itemLabel: "Rank", placeholder: "A rank, from top to bottom" },
    { key: "territory", label: "Territory", kind: "list", section: "Organization", itemLabel: "Territory", placeholder: "Where they hold sway" },
    { key: "assets", label: "Major Assets", kind: "list", section: "Organization", itemLabel: "Asset", placeholder: "A notable resource or holding" },
    // —— Relationships ——
    { key: "allies", label: "Allies", kind: "list", section: "Relationships", itemLabel: "Ally", placeholder: "A friendly faction or power" },
    { key: "rivals", label: "Rivals & Enemies", kind: "list", section: "Relationships", itemLabel: "Rival", placeholder: "An opposing faction or power" },
    // —— Lore & Secrets ——
    { key: "history", label: "History", kind: "textarea", section: "Lore & Secrets", placeholder: "How the faction came to be" },
    { key: "symbols", label: "Symbols", kind: "list", section: "Lore & Secrets", itemLabel: "Symbol", placeholder: "An emblem, token, or sign" },
    { key: "rumors", label: "Rumors", kind: "list", section: "Lore & Secrets", itemLabel: "Rumor", placeholder: "A rumor about the faction" },
    { key: "hooks", label: "Plot Hooks", kind: "list", section: "Lore & Secrets", itemLabel: "Hook", placeholder: "An adventure seed" },
    { key: "secrets", label: "Secrets", kind: "textarea", section: "Lore & Secrets", placeholder: "Hidden truths (DM-only in campaigns)" },
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
