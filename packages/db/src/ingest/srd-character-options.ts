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
import { seedSubclasses } from "./srd-subclasses";
import type { Ability, AbilityScores } from "@app/engine";

export interface SeedSpecies {
  slug: string;
  name: string;
  description: string;
  abilityBonuses: Partial<AbilityScores>;
  speed: number;
  size: "Small" | "Medium";
  traits: string[];
}

export interface SeedClass {
  slug: string;
  name: string;
  description: string;
  hitDie: number;
  savingThrows: Ability[];
  skillChoice: SkillChoice;
}

export const SRD_SPECIES: SeedSpecies[] = [
  {
    slug: "hill-dwarf",
    name: "Hill Dwarf",
    description:
      "As a hill dwarf, you have keen senses, deep intuition, and remarkable resilience. Hill dwarves are known as the most common dwarven folk — hardy, wise, and at home in rugged highlands.",
    abilityBonuses: { con: 2, wis: 1 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning", "Dwarven Toughness"],
  },
  {
    slug: "mountain-dwarf",
    name: "Mountain Dwarf",
    description:
      "As a mountain dwarf, you are strong and hardy, accustomed to a difficult life in rugged terrain. Mountain dwarves are trained for battle from youth and comfortable in armor.",
    abilityBonuses: { con: 2, str: 2 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Dwarven Armor Training"],
  },
  {
    slug: "high-elf",
    name: "High Elf",
    description:
      "As a high elf, you have a keen mind and a mastery of at least the basics of magic. High elves are graceful, long-lived, and often devoted to art, scholarship, or wizardry.",
    abilityBonuses: { dex: 2, int: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Cantrip"],
  },
  {
    slug: "wood-elf",
    name: "Wood Elf",
    description:
      "As a wood elf, you have keen senses and intuition, and your fleet feet carry you quickly and stealthily through your native forests. Wood elves are reclusive guardians of wild places.",
    abilityBonuses: { dex: 2, wis: 1 },
    speed: 35,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Mask of the Wild"],
  },
  {
    slug: "lightfoot-halfling",
    name: "Lightfoot Halfling",
    description:
      "As a lightfoot halfling, you can easily hide from notice, even using other people as cover. Lightfoots are nomadic and friendly, traveling widely and making friends wherever they go.",
    abilityBonuses: { dex: 2, cha: 1 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness", "Naturally Stealthy"],
  },
  {
    slug: "stout-halfling",
    name: "Stout Halfling",
    description:
      "As a stout halfling, you are hardier than average and have some resistance to poison. Stouts are often found in farming communities and are less inclined to wander than lightfoots.",
    abilityBonuses: { dex: 2, con: 1 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness", "Stout Resilience"],
  },
  {
    slug: "human",
    name: "Human",
    description:
      "Humans are the most adaptable and ambitious people among the common races. Whatever drives them, humans are the innovators, the achievers, and the pioneers of the worlds they inhabit.",
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Versatile"],
  },
  {
    slug: "dragonborn",
    name: "Dragonborn",
    description:
      "Born of dragons, dragonborn walk proudly through a world that greets them with fearful incomprehension. Their draconic ancestry grants breath weapons, elemental resilience, and a proud bearing.",
    abilityBonuses: { str: 2, cha: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
  },
  {
    slug: "rock-gnome",
    name: "Rock Gnome",
    description:
      "As a rock gnome, you have a natural inventiveness and hardiness beyond that of other gnomes. Rock gnomes are tinkerers and illusionists, delighting in clever devices and subtle magic.",
    abilityBonuses: { int: 2, con: 1 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning", "Artificer's Lore", "Tinker"],
  },
  {
    slug: "forest-gnome",
    name: "Forest Gnome",
    description:
      "As a forest gnome, you have a natural knack for illusion and an affinity with small woodland creatures. Forest gnomes are rare and secretive, rarely seen by outsiders.",
    abilityBonuses: { int: 2, dex: 1 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning", "Natural Illusionist", "Speak with Small Beasts"],
  },
  {
    slug: "half-orc",
    name: "Half-Orc",
    description:
      "Half-orcs combine the best qualities of humans and orcs: human ambition and orcish strength and endurance. Many half-orcs rise to prove their worth in a world that often shuns them.",
    abilityBonuses: { str: 2, con: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
  },
  {
    slug: "tiefling",
    name: "Tiefling",
    description:
      "To be greeted with stares and whispers is the lot of tieflings — bearers of a distant infernal legacy. Their appearance and heritage grant resistance to fire and a talent for minor magic.",
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
    description:
      "A fierce warrior of primitive background who can enter a battle rage. Barbarians channel primal fury to gain extraordinary might and resilience in combat.",
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
    description:
      "An inspiring magician whose power echoes the music of creation. Bards weave song, speech, and magic to bolster allies, hinder foes, and shape the tide of adventure.",
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
    description:
      "A priestly champion who wields divine magic in service of a higher power. Clerics heal the wounded, protect the faithful, and smite their deity's foes.",
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
    description:
      "A priest of the Old Faith, wielding the powers of nature and adopting animal forms. Druids revere the wild and guard the balance between civilization and the natural world.",
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
    description:
      "A master of martial combat, skilled with a variety of weapons and armor. Fighters learn diverse combat techniques and excel in any battlefield role.",
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
    description:
      "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection. Monks strike with speed and channel ki for supernatural feats.",
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
    description:
      "A holy warrior bound to a sacred oath, combining martial prowess with divine magic. Paladins stand as champions of justice, mercy, and their sworn ideals.",
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
    description:
      "A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization. Rangers are skilled hunters and guardians of the wild.",
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
    description:
      "A scoundrel who uses stealth and trickery to overcome obstacles and enemies. Rogues rely on skill, precision, and exploiting an opponent's distraction.",
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
    description:
      "A spellcaster who draws on inherent magic from a gift or bloodline. Sorcerers shape raw arcane power through force of personality rather than study.",
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
    description:
      "A wielder of magic derived from a bargain with an extraplanar entity. Warlocks gain eldritch invocations and pact magic from their otherworldly patron.",
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
    description:
      "A scholarly magic-user capable of manipulating the structures of reality. Wizards learn spells through rigorous study and record them in a spellbook.",
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
  subclasses: number;
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
        description: s.description,
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
        description: sql`excluded.description`,
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
        description: c.description,
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
        description: sql`excluded.description`,
        hitDie: sql`excluded.hit_die`,
        savingThrows: sql`excluded.saving_throws`,
        skillChoice: sql`excluded.skill_choice`,
        source: sql`excluded.source`,
        ingestedAt: sql`now()`,
      },
    });

  const { subclasses } = await seedSubclasses(db);

  return { species: SRD_SPECIES.length, classes: SRD_CLASSES.length, subclasses };
}
