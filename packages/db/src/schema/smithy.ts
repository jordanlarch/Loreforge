import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ItemDefinition,
  ItemRarity,
  ItemSource,
  ItemType,
  SpellDefinition,
  SpellSchool,
} from "@app/engine";

/**
 * Homebrew items forged in the Smithy (#4), owned by a Supabase auth user.
 *
 * The first Smithy surface: custom items only (the full category tree —
 * species, monsters, spells, … — comes later). `source`/`copiedFromSlug` carry
 * provenance so a future "Copy from Codex" can deep-link back to the SRD
 * original; the copy plumbing itself is stubbed until Codex items are ingested.
 * Full declarative mechanics live in `definition` (engine `ItemDefinition`);
 * imperative sandbox handlers remain deferred.
 *
 * @see docs/ui-flows/smithy.md
 */
export const homebrewItems = pgTable(
  "homebrew_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().$type<ItemType>(),
    rarity: text("rarity").notNull().$type<ItemRarity>().default("Common"),
    properties: jsonb("properties").notNull().$type<string[]>().default([]),
    description: text("description").notNull().default(""),
    requiresAttunement: boolean("requires_attunement").notNull().default(false),
    /** "original" (forged from scratch) or "codex" (copied from SRD). */
    source: text("source").notNull().$type<ItemSource>().default("original"),
    /** Codex slug this was copied from, if any (for future copy plumbing). */
    copiedFromSlug: text("copied_from_slug"),
    /** Declarative item definition validated against the engine shape (SMITH-7). */
    definition: jsonb("definition").notNull().$type<ItemDefinition>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("homebrew_items_owner_idx").on(t.ownerId)],
);

/**
 * Homebrew spells authored in the Smithy (#8), owned by a Supabase auth user.
 *
 * Stores the full declarative {@link SpellDefinition} (engine §7.2 subset) in
 * `definition`, with `name`/`level`/`school` denormalized to columns for listing
 * and filtering (mirrors `codex_spells`). The API validates `definition` against
 * the engine's `validateSpellDefinition` before insert, so every stored row
 * satisfies the engine contract and is consumable once spell resolution lands.
 * The imperative escape hatch / sandbox is out of scope here (declarative only).
 *
 * @see docs/engine/architecture.md §7
 */
export const homebrewSpells = pgTable(
  "homebrew_spells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    /** 0 (cantrip) through 9, denormalized from `definition` for filtering. */
    level: integer("level").notNull(),
    school: text("school").notNull().$type<SpellSchool>(),
    description: text("description").notNull().default(""),
    /** Full declarative spell definition validated against the engine shape. */
    definition: jsonb("definition").notNull().$type<SpellDefinition>(),
    /** "original" (authored) or "codex" (copied from SRD). */
    source: text("source").notNull().$type<ItemSource>().default("original"),
    /** Codex slug this was copied from, if any (for future copy plumbing). */
    copiedFromSlug: text("copied_from_slug"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("homebrew_spells_owner_idx").on(t.ownerId),
    index("homebrew_spells_level_idx").on(t.level),
  ],
);
