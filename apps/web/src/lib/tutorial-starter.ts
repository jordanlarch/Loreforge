/**
 * Tutorial starter character (TUT-1, #177) — Mira Thornwood as an owned
 * sandbox hero for the frictionless skip→starter handoff.
 *
 * Shared by `tutorial.start` (tutorial campaign seed) and `tutorial.skip` (a
 * standalone owned character when the user bails from the splash). Idempotent
 * by name per owner so repeated skips never duplicate Mira.
 */
import { and, eq } from "drizzle-orm";

import { characters, getDb } from "@app/db";

/** Pregenerated starter hero (`docs/onboarding/tutorial-adventure.md` §2.1). */
export const STARTER_MIRA: Omit<typeof characters.$inferInsert, "ownerId"> = {
  name: "Mira Thornwood",
  species: "Half-Elf",
  background: "Outlander",
  classes: [{ class: "Ranger", level: 3, subclass: "Hunter" }],
  abilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 },
  maxHp: 27,
  baseAc: 14,
  speed: 30,
  saveProficiencies: ["str", "dex"],
  skillProficiencies: ["Stealth", "Perception", "Survival", "Investigation"],
  xp: 900,
  notes:
    "Optional starter character — seeded when you skip the tutorial. Edit or delete anytime.",
  equipment: [
    { name: "Longbow", quantity: 1, equipped: true },
    { name: "Shortsword", quantity: 2, equipped: true },
    { name: "Leather Armor", quantity: 1, equipped: true },
    { name: "Potion of Healing", quantity: 2, equipped: false },
  ],
  spells: {
    spells: [
      { name: "Hunter's Mark", level: 1, prepared: true },
      { name: "Cure Wounds", level: 1, prepared: true },
    ],
    slots: { "1": { max: 3, used: 0 } },
  },
};

/** The companion NPC seeded for Scene 2 (`tutorial-adventure.md` §2.2). */
export const STARTER_BRENNAR: Omit<typeof characters.$inferInsert, "ownerId"> =
  {
    name: "Old Brennar",
    species: "Human",
    background: "Acolyte",
    classes: [{ class: "Cleric", level: 2, subclass: "Life" }],
    abilityScores: { str: 11, dex: 10, con: 12, int: 10, wis: 15, cha: 13 },
    maxHp: 17,
    baseAc: 13,
    speed: 30,
    saveProficiencies: ["wis", "cha"],
    skillProficiencies: ["Insight", "Medicine", "Religion"],
    xp: 450,
    notes:
      "Your companion through the Hollow — a grieving cleric who knew the lampkeeper. Pregenerated for the tutorial.",
    equipment: [
      { name: "Mace", quantity: 1, equipped: true },
      { name: "Chain Shirt", quantity: 1, equipped: true },
      { name: "Holy Symbol", quantity: 1, equipped: true },
      { name: "Potion of Healing", quantity: 1, equipped: false },
    ],
    spells: {
      spells: [
        { name: "Sacred Flame", level: 0, prepared: true },
        { name: "Cure Wounds", level: 1, prepared: true },
      ],
      slots: { "1": { max: 3, used: 0 } },
    },
  };

/**
 * Seed Mira as a standalone owned character for the skip path. Idempotent: a
 * second call is a no-op when she already exists for this owner.
 */
export async function seedStarterCharacter(
  ownerId: string,
): Promise<{ characterId: string | null; created: boolean }> {
  const db = getDb();
  const [existing] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(eq(characters.ownerId, ownerId), eq(characters.name, STARTER_MIRA.name)),
    )
    .limit(1);
  if (existing) return { characterId: existing.id, created: false };

  const [row] = await db
    .insert(characters)
    .values({ ...STARTER_MIRA, ownerId })
    .returning({ id: characters.id });
  return { characterId: row?.id ?? null, created: Boolean(row) };
}

/** Resolve an owned character by name, or null. */
export async function findOwnedCharacter(
  ownerId: string,
  name: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.ownerId, ownerId), eq(characters.name, name)))
    .limit(1);
  return row?.id ?? null;
}
