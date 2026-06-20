/**
 * Curated SRD character-creation options (species + classes) for the Creation
 * Wizard (#6).
 *
 * Why curated rather than Open5e-ingested: Open5e's race/class records express
 * ability bonuses and skill choices as free-text prose ("Choose two from …"),
 * which is fragile to parse into the structured shape the wizard needs. This
 * in-repo dataset is the SRD 5.1 core, hand-normalized. It is seeded into
 * `codex_species` / `codex_classes` via {@link seedCharacterOptions} so the
 * wizard reads it over the same tRPC→DB path a future structured Open5e race
 * ingest would use — swapping the source later won't touch the wizard.
 *
 * Scope: fixed-bonus species only (variable-ASI lineages like Half-Elf and
 * point-of-choice subraces are a follow-up). Backgrounds/equipment/spells are
 * out of #6's stepper.
 *
 * @see docs/data-sources.md §1
 * @see docs/ui-flows/character-creation-wizard.md
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexClasses, codexSpecies, type SkillChoice } from "../schema/codex";
import type { Ability, AbilityScores } from "@app/engine";

export interface SeedSpecies {
  slug: string;
  name: string;
  abilityBonuses: Partial<AbilityScores>;
  speed: number;
  size: "Small" | "Medium";
  traits: string[];
}

export interface SeedClass {
  slug: string;
  name: string;
  hitDie: number;
  savingThrows: Ability[];
  skillChoice: SkillChoice;
}

export const SRD_SPECIES: SeedSpecies[] = [
  {
    slug: "hill-dwarf",
    name: "Hill Dwarf",
    abilityBonuses: { con: 2, wis: 1 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning", "Dwarven Toughness"],
  },
  {
    slug: "mountain-dwarf",
    name: "Mountain Dwarf",
    abilityBonuses: { con: 2, str: 2 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Dwarven Armor Training"],
  },
  {
    slug: "high-elf",
    name: "High Elf",
    abilityBonuses: { dex: 2, int: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Cantrip"],
  },
  {
    slug: "wood-elf",
    name: "Wood Elf",
    abilityBonuses: { dex: 2, wis: 1 },
    speed: 35,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Mask of the Wild"],
  },
  {
    slug: "lightfoot-halfling",
    name: "Lightfoot Halfling",
    abilityBonuses: { dex: 2, cha: 1 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness", "Naturally Stealthy"],
  },
  {
    slug: "stout-halfling",
    name: "Stout Halfling",
    abilityBonuses: { dex: 2, con: 1 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness", "Stout Resilience"],
  },
  {
    slug: "human",
    name: "Human",
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Versatile"],
  },
  {
    slug: "dragonborn",
    name: "Dragonborn",
    abilityBonuses: { str: 2, cha: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
  },
  {
    slug: "rock-gnome",
    name: "Rock Gnome",
    abilityBonuses: { int: 2, con: 1 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning", "Artificer's Lore", "Tinker"],
  },
  {
    slug: "forest-gnome",
    name: "Forest Gnome",
    abilityBonuses: { int: 2, dex: 1 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning", "Natural Illusionist", "Speak with Small Beasts"],
  },
  {
    slug: "half-orc",
    name: "Half-Orc",
    abilityBonuses: { str: 2, con: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
  },
  {
    slug: "tiefling",
    name: "Tiefling",
    abilityBonuses: { cha: 2, int: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
  },
];

export const SRD_CLASSES: SeedClass[] = [
  {
    slug: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    savingThrows: ["str", "con"],
    skillChoice: {
      choose: 2,
      from: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"],
    },
  },
  {
    slug: "bard",
    name: "Bard",
    hitDie: 8,
    savingThrows: ["dex", "cha"],
    skillChoice: {
      choose: 3,
      from: [
        "Acrobatics",
        "Animal Handling",
        "Arcana",
        "Athletics",
        "Deception",
        "History",
        "Insight",
        "Intimidation",
        "Investigation",
        "Medicine",
        "Nature",
        "Perception",
        "Performance",
        "Persuasion",
        "Religion",
        "Sleight of Hand",
        "Stealth",
        "Survival",
      ],
    },
  },
  {
    slug: "cleric",
    name: "Cleric",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      choose: 2,
      from: ["History", "Insight", "Medicine", "Persuasion", "Religion"],
    },
  },
  {
    slug: "druid",
    name: "Druid",
    hitDie: 8,
    savingThrows: ["int", "wis"],
    skillChoice: {
      choose: 2,
      from: [
        "Arcana",
        "Animal Handling",
        "Insight",
        "Medicine",
        "Nature",
        "Perception",
        "Religion",
        "Survival",
      ],
    },
  },
  {
    slug: "fighter",
    name: "Fighter",
    hitDie: 10,
    savingThrows: ["str", "con"],
    skillChoice: {
      choose: 2,
      from: [
        "Acrobatics",
        "Animal Handling",
        "Athletics",
        "History",
        "Insight",
        "Intimidation",
        "Perception",
        "Survival",
      ],
    },
  },
  {
    slug: "monk",
    name: "Monk",
    hitDie: 8,
    savingThrows: ["str", "dex"],
    skillChoice: {
      choose: 2,
      from: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"],
    },
  },
  {
    slug: "paladin",
    name: "Paladin",
    hitDie: 10,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      choose: 2,
      from: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"],
    },
  },
  {
    slug: "ranger",
    name: "Ranger",
    hitDie: 10,
    savingThrows: ["str", "dex"],
    skillChoice: {
      choose: 3,
      from: [
        "Animal Handling",
        "Athletics",
        "Insight",
        "Investigation",
        "Nature",
        "Perception",
        "Stealth",
        "Survival",
      ],
    },
  },
  {
    slug: "rogue",
    name: "Rogue",
    hitDie: 8,
    savingThrows: ["dex", "int"],
    skillChoice: {
      choose: 4,
      from: [
        "Acrobatics",
        "Athletics",
        "Deception",
        "Insight",
        "Intimidation",
        "Investigation",
        "Perception",
        "Performance",
        "Persuasion",
        "Sleight of Hand",
        "Stealth",
      ],
    },
  },
  {
    slug: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    savingThrows: ["con", "cha"],
    skillChoice: {
      choose: 2,
      from: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"],
    },
  },
  {
    slug: "warlock",
    name: "Warlock",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      choose: 2,
      from: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"],
    },
  },
  {
    slug: "wizard",
    name: "Wizard",
    hitDie: 6,
    savingThrows: ["int", "wis"],
    skillChoice: {
      choose: 2,
      from: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
    },
  },
];

export interface SeedCharacterOptionsResult {
  species: number;
  classes: number;
}

/**
 * Idempotently seed the curated SRD species + classes into the Codex. Upserts by
 * slug, so re-running is safe (used by the manual CLI and the nightly job).
 */
export async function seedCharacterOptions(
  db: Database,
): Promise<SeedCharacterOptionsResult> {
  await db
    .insert(codexSpecies)
    .values(
      SRD_SPECIES.map((s) => ({
        slug: s.slug,
        name: s.name,
        abilityBonuses: s.abilityBonuses,
        speed: s.speed,
        size: s.size,
        traits: s.traits,
        source: "srd",
        raw: {},
      })),
    )
    .onConflictDoUpdate({
      target: codexSpecies.slug,
      set: {
        name: sql`excluded.name`,
        abilityBonuses: sql`excluded.ability_bonuses`,
        speed: sql`excluded.speed`,
        size: sql`excluded.size`,
        traits: sql`excluded.traits`,
        source: sql`excluded.source`,
        ingestedAt: sql`now()`,
      },
    });

  await db
    .insert(codexClasses)
    .values(
      SRD_CLASSES.map((c) => ({
        slug: c.slug,
        name: c.name,
        hitDie: c.hitDie,
        savingThrows: c.savingThrows,
        skillChoice: c.skillChoice,
        source: "srd",
        raw: {},
      })),
    )
    .onConflictDoUpdate({
      target: codexClasses.slug,
      set: {
        name: sql`excluded.name`,
        hitDie: sql`excluded.hit_die`,
        savingThrows: sql`excluded.saving_throws`,
        skillChoice: sql`excluded.skill_choice`,
        source: sql`excluded.source`,
        ingestedAt: sql`now()`,
      },
    });

  return { species: SRD_SPECIES.length, classes: SRD_CLASSES.length };
}
