import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("characters_owner_idx").on(t.ownerId)],
);
