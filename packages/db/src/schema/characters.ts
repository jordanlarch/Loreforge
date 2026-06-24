import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

type AbilityScores = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

type ClassLevel = {
  class: string;
  level: number;
  subclass?: string;
};

/** Whether a character appears on `/characters` (My Characters). */
export const CHARACTER_LIBRARY_VISIBILITY = ["library", "campaign_only"] as const;
export type CharacterLibraryVisibility =
  (typeof CHARACTER_LIBRARY_VISIBILITY)[number];

/**
 * A single inventory/equipment entry (#56, rich shape). `name`/`quantity`/
 * `equipped` are always present; the rest are optional so generators and the
 * future Equipment tab (CHAR-7) can enrich items incrementally. `smithyItemId`
 * links to a homebrew Smithy item for the "Use in Character" flow (SMITH-5).
 */
export type EquipmentItem = {
  name: string;
  quantity: number;
  equipped: boolean;
  slot?: string;
  smithyItemId?: string;
  weight?: number;
  rarity?: string;
  attunement?: boolean;
  description?: string;
};

/** A spell on a character's list; `prepared` distinguishes known vs prepared. */
export type CharacterSpell = {
  name: string;
  /** 0 = cantrip, 1–9 = spell level. */
  level: number;
  prepared: boolean;
  /** Granted always-prepared (domain/oath/feat); doesn't count against prepared. */
  alwaysPrepared?: boolean;
  /** What grants it, e.g. a class or feat name. */
  source?: string;
};

/**
 * A character's spell loadout (#56). `spells` is one unified list (a `prepared`
 * flag separates known from prepared); `slots` tracks per-level pools keyed by
 * level ("1".."9"). The engine may later own `max` (derived from class/level);
 * stored here for now so the data round-trips and supports manual overrides.
 */
export type SpellLoadout = {
  spells: CharacterSpell[];
  slots: Record<string, { max: number; used: number }>;
};

const EMPTY_SPELLS: SpellLoadout = { spells: [], slots: {} };

/**
 * Persistent player characters, owned by a Supabase auth user.
 *
 * Mirrors the engine's character input shape so the read-only sheet derives
 * mods / proficiency / saves / skills through `@app/engine` (no math in the
 * app layer — see the deterministic-engine decision in
 * `docs/00-consolidated-plan.md`). The Creation Wizard (#6) and inline edit
 * (#7) build on top of this table.
 */
export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    species: text("species").notNull().default(""),
    background: text("background").notNull().default(""),
    classes: jsonb("classes").notNull().$type<ClassLevel[]>().default([]),
    abilityScores: jsonb("ability_scores").notNull().$type<AbilityScores>(),
    maxHp: integer("max_hp").notNull(),
    baseAc: integer("base_ac").notNull(),
    speed: integer("speed").notNull().default(30),
    saveProficiencies: jsonb("save_proficiencies")
      .notNull()
      .$type<Array<keyof AbilityScores>>()
      .default([]),
    skillProficiencies: jsonb("skill_proficiencies")
      .notNull()
      .$type<string[]>()
      .default([]),
    /** Experience points (#56) — drives XP-gated level-up (CHAR-9). */
    xp: integer("xp").notNull().default(0),
    /** Portrait image URL (#56). Upload pipeline is deferred; URL stub for now. */
    portraitUrl: text("portrait_url").notNull().default(""),
    /** Freeform player notes / backstory (#56). */
    notes: text("notes").notNull().default(""),
    equipment: jsonb("equipment")
      .notNull()
      .$type<EquipmentItem[]>()
      .default([]),
    spells: jsonb("spells")
      .notNull()
      .$type<SpellLoadout>()
      .default(EMPTY_SPELLS),
    /**
     * `library` — shown on the Characters tab (player-created heroes).
     * `campaign_only` — campaign/tutor pregen rows until the player imports them.
     */
    libraryVisibility: text("library_visibility")
      .notNull()
      .default("library")
      .$type<CharacterLibraryVisibility>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("characters_owner_idx").on(t.ownerId)],
);

/**
 * Character ↔ campaign membership (#56). A character can join multiple
 * campaigns; a campaign has a party of characters. `role`/`status` support the
 * Party tab's companions + bench (CAMP-3); `ownerId` denormalizes the owner for
 * owner-scoped queries (consistent with the no-FK, app-scoped convention here).
 */
export const campaignCharacters = pgTable(
  "campaign_characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    characterId: uuid("character_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    /** pc | companion | npc-ally */
    role: text("role").notNull().default("pc"),
    /** active | bench */
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_characters_unique_idx").on(
      t.campaignId,
      t.characterId,
    ),
    index("campaign_characters_campaign_idx").on(t.campaignId),
    index("campaign_characters_character_idx").on(t.characterId),
    index("campaign_characters_owner_idx").on(t.ownerId),
  ],
);
