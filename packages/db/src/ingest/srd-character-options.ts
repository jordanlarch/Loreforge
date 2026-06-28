/**
 * Curated SRD character-creation options (species + classes) for the Creation
 * Wizard (#6).
 *
 * Why curated rather than Open5e-ingested: Open5e's race/class records express
 * ability bonuses and skill choices as free-text prose ("Choose two from …"),
 * which is fragile to parse into the structured shape the wizard needs. This
 * in-repo dataset is the SRD 5.2.1 core (9 unified species), hand-normalized
 * from the official PDF. It is seeded into `codex_species` / `codex_classes`
 * via {@link seedCharacterOptions} so the wizard reads it over the same
 * tRPC→DB path a future structured Open5e race ingest would use — swapping the
 * source later won't touch the wizard.
 *
 * SRD 2024 species do not grant fixed ability score increases; those come from
 * the character's background (+2/+1 or three +1s). `abilityBonuses` is kept
 * empty on species rows until background ASI is wired in the wizard.
 *
 * @see docs/data-sources.md §1
 * @see docs/ui-flows/character-creation-wizard.md
 * @see docs/srd-version-audit.md (SRD-AUDIT-4)
 */
import { and, eq, notInArray, sql } from "drizzle-orm";

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
    slug: "dragonborn",
    name: "Dragonborn",
    description:
      "Dragonborn descend from dragon progenitors. Your draconic ancestry shapes your breath weapon, damage resistance, and appearance — and at higher levels grants spectral wings.",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: [
      "Draconic Ancestry",
      "Breath Weapon",
      "Damage Resistance",
      "Darkvision",
      "Draconic Flight",
    ],
  },
  {
    slug: "dwarf",
    name: "Dwarf",
    description:
      "Dwarves are hardy folk at home in rugged highlands and deep halls. You have exceptional darkvision, resilience to poison, extra hit points, and stonecunning tremorsense.",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: [
      "Darkvision",
      "Dwarven Resilience",
      "Dwarven Toughness",
      "Stonecunning",
    ],
  },
  {
    slug: "elf",
    name: "Elf",
    description:
      "Elves are graceful, long-lived, and attuned to fey magic. Choose an elven lineage (Drow, High Elf, or Wood Elf) for lineage spells and extra benefits.",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Elven Lineage", "Fey Ancestry", "Keen Senses", "Trance"],
  },
  {
    slug: "gnome",
    name: "Gnome",
    description:
      "Gnomes are small, clever, and often magical. Choose Forest Gnome or Rock Gnome lineage for cantrips, spells, and tinkering tricks.",
    abilityBonuses: {},
    speed: 30,
    size: "Small",
    traits: ["Darkvision", "Gnomish Cunning", "Gnomish Lineage"],
  },
  {
    slug: "goliath",
    name: "Goliath",
    description:
      "Goliaths trace their ancestry to giants. You inherit a supernatural boon from that heritage and can grow to Large size at higher levels.",
    abilityBonuses: {},
    speed: 35,
    size: "Medium",
    traits: ["Giant Ancestry", "Large Form", "Powerful Build"],
  },
  {
    slug: "halfling",
    name: "Halfling",
    description:
      "Halflings are small, nimble, and quietly brave. You can slip through larger creatures' spaces, reroll natural 1s, and hide behind bigger allies.",
    abilityBonuses: {},
    speed: 30,
    size: "Small",
    traits: ["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"],
  },
  {
    slug: "human",
    name: "Human",
    description:
      "Humans are adaptable and ambitious. You gain Heroic Inspiration on long rests, an extra skill proficiency, and an Origin feat (Medium or Small size).",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: ["Resourceful", "Skillful", "Versatile"],
  },
  {
    slug: "orc",
    name: "Orc",
    description:
      "Orcs combine strength with relentless endurance. You can dash as a bonus action for temporary hit points and shrug off a killing blow once per long rest.",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: ["Adrenaline Rush", "Darkvision", "Relentless Endurance"],
  },
  {
    slug: "tiefling",
    name: "Tiefling",
    description:
      "Tieflings bear a fiendish legacy. Choose a fiendish legacy for resistance and lineage spells, and know the Thaumaturgy cantrip (Medium or Small size).",
    abilityBonuses: {},
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Fiendish Legacy", "Otherworldly Presence"],
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
  speciesPruned: number;
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

  const curatedSlugs = SRD_SPECIES.map((s) => s.slug);
  const prunedRows = await db
    .delete(codexSpecies)
    .where(
      and(
        eq(codexSpecies.source, "srd"),
        notInArray(codexSpecies.slug, curatedSlugs),
      ),
    )
    .returning({ slug: codexSpecies.slug });
  const speciesPruned = prunedRows.length;
  if (speciesPruned > 0) {
    console.log(
      `[seed:character-options] Pruned ${speciesPruned} legacy SRD species row(s): ${prunedRows.map((r) => r.slug).join(", ")}`,
    );
  }

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

  return {
    species: SRD_SPECIES.length,
    speciesPruned,
    classes: SRD_CLASSES.length,
    subclasses,
  };
}
