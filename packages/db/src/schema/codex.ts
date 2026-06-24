import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { Ability, AbilityScores } from "@app/engine";

/**
 * Normalized SRD reference rows (Open5e / 5e-bits ingest).
 * P0 spike: spells only; expand in P1 Codex MVP.
 */
export const codexSpells = pgTable(
  "codex_spells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    level: text("level"),
    school: text("school"),
    source: text("source").notNull().default("open5e"),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("codex_spells_name_idx").on(t.name),
    index("codex_spells_level_idx").on(t.level),
  ],
);

/**
 * SRD creatures / monsters from Open5e ingest (CODEX-1).
 * Animals in the Codex UI filter `creature_type = beast` and CR ≤ 1.
 */
export const codexMonsters = pgTable(
  "codex_monsters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Open5e type key, e.g. beast, dragon, aberration. */
    creatureType: text("creature_type"),
    /** Open5e size key, e.g. medium, large. */
    size: text("size"),
    challengeRating: real("challenge_rating"),
    armorClass: integer("armor_class"),
    hitPoints: integer("hit_points"),
    alignment: text("alignment"),
    source: text("source").notNull().default("open5e"),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("codex_monsters_name_idx").on(t.name),
    index("codex_monsters_type_idx").on(t.creatureType),
    index("codex_monsters_cr_idx").on(t.challengeRating),
  ],
);

/** How many skills a class lets you pick at level 1, and from which list. */
export type SkillChoice = {
  choose: number;
  from: string[];
};

/**
 * SRD player species/lineages, used by the Creation Wizard (#6).
 *
 * Seeded from a curated in-repo SRD dataset (`ingest/srd-character-options.ts`)
 * via `seedCharacterOptions()` — same DB-backed access pattern the wizard will
 * use once full Open5e race ingest lands (`docs/data-sources.md` §1), so the
 * wizard code won't change when the data source is swapped.
 */
export const codexSpecies = pgTable(
  "codex_species",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Net ability score increases (e.g. Hill Dwarf → { con: 2, wis: 1 }). */
    abilityBonuses: jsonb("ability_bonuses")
      .notNull()
      .$type<Partial<AbilityScores>>()
      .default({}),
    speed: integer("speed").notNull().default(30),
    size: text("size").notNull().default("Medium"),
    traits: jsonb("traits").notNull().$type<string[]>().default([]),
    /** SRD flavor / overview paragraph for Codex detail. */
    description: text("description").notNull().default(""),
    source: text("source").notNull().default("srd"),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>().default({}),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("codex_species_name_idx").on(t.name)],
);

/** SRD player classes, used by the Creation Wizard (#6). */
export const codexClasses = pgTable(
  "codex_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Hit die size (e.g. Fighter → 10 for d10). */
    hitDie: integer("hit_die").notNull(),
    /** Ability saving throws this class is proficient in. */
    savingThrows: jsonb("saving_throws").notNull().$type<Ability[]>().default([]),
    /** Level-1 skill proficiency choice (count + eligible skills). */
    skillChoice: jsonb("skill_choice").notNull().$type<SkillChoice>(),
    /** SRD class overview for Codex detail. */
    description: text("description").notNull().default(""),
    source: text("source").notNull().default("srd"),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>().default({}),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("codex_classes_name_idx").on(t.name)],
);
