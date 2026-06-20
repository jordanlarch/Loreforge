import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { ItemRarity, ItemSource, ItemType } from "@app/engine";

/**
 * Homebrew items forged in the Smithy (#4), owned by a Supabase auth user.
 *
 * The first Smithy surface: custom items only (the full category tree —
 * species, monsters, spells, … — comes later). `source`/`copiedFromSlug` carry
 * provenance so a future "Copy from Codex" can deep-link back to the SRD
 * original; the copy plumbing itself is stubbed until Codex items are ingested.
 * Full item mechanics (engine `EffectTemplate`) are out of scope here.
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("homebrew_items_owner_idx").on(t.ownerId)],
);
