import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
