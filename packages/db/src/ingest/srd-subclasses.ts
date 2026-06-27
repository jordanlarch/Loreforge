/**
 * Curated SRD subclass records for Codex browse + character creation (CODEX-SUBCLASSES).
 * Hand-normalized summaries; full Open5e subclass ingest deferred.
 */
import { and, eq, notInArray, sql } from "drizzle-orm";

import {
  SUBCLASS_OPTIONS,
  subclassPickLevel,
} from "@app/engine";

import type { Database } from "../client";
import { codexSubclasses, type SubclassFeature } from "../schema/codex";

export interface SeedSubclass {
  slug: string;
  name: string;
  classSlug: string;
  className: string;
  pickLevel: number;
  description: string;
  features: SubclassFeature[];
}

const CLASS_SLUGS: Record<string, string> = {
  Barbarian: "barbarian",
  Bard: "bard",
  Cleric: "cleric",
  Druid: "druid",
  Fighter: "fighter",
  Monk: "monk",
  Paladin: "paladin",
  Ranger: "ranger",
  Rogue: "rogue",
  Sorcerer: "sorcerer",
  Warlock: "warlock",
  Wizard: "wizard",
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "subclass"
  );
}

/** One-line SRD summaries keyed by subclass display name. */
const SUBCLASS_DESCRIPTIONS: Record<string, string> = {
  "Path of the Berserker":
    "Barbarians who channel rage into reckless fury, gaining Frenzy and brutal retaliation.",
  "Path of the Totem Warrior":
    "Barbarians who adopt animal totems for spiritual power and defensive resilience.",
  "College of Lore":
    "Bards who collect secrets and lore, gaining extra skills and cutting words.",
  "College of Valor":
    "Bards trained for battle who inspire allies while holding the front line.",
  "Life Domain":
    "Clerics devoted to preserving life, with superior healing and protective magic.",
  "Light Domain":
    "Clerics who wield radiant fire to banish darkness and sear foes.",
  "Nature Domain":
    "Clerics who channel the power of forests, beasts, and the natural world.",
  "Tempest Domain":
    "Clerics who command storms, thunder, and lightning on the battlefield.",
  "Trickery Domain":
    "Clerics of deception who mislead foes and protect allies with illusions.",
  "War Domain":
    "Clerics who excel in battle, granting martial prowess and war magic.",
  "Circle of the Land":
    "Druids tied to a terrain whose magic reflects their chosen land's essence.",
  "Circle of the Moon":
    "Druids who master wild shape combat forms and lunar ferocity.",
  Champion:
    "Fighters focused on raw athletic excellence — critical hits and physical prowess.",
  "Battle Master":
    "Fighters who use tactical maneuvers to control the battlefield.",
  "Eldritch Knight":
    "Fighters who blend weapon mastery with abjuration and evocation magic.",
  "Way of the Open Hand":
    "Monks who manipulate ki for stunning strikes and defensive mastery.",
  "Way of Shadow":
    "Monks who use darkness and stealth like ninjas on the battlefield.",
  "Way of the Four Elements":
    "Monks who harness elemental ki for spell-like disciplines.",
  "Oath of Devotion":
    "Paladins who uphold honor, protection, and radiant justice.",
  "Oath of the Ancients":
    "Paladins who preserve beauty, laughter, and the light against annihilation.",
  "Oath of Vengeance":
    "Paladins who pursue relentless justice against the wicked.",
  Hunter:
    "Rangers specialized in slaying specific threats with tactical superiority.",
  Thief:
    "Rogues skilled in larceny, climbing, and using magic items quickly.",
  Assassin:
    "Rogues trained in infiltration and delivering lethal surprise attacks.",
  "Arcane Trickster":
    "Rogues who augment stealth with illusion and enchantment magic.",
  "Draconic Bloodline":
    "Sorcerers whose magic stems from draconic ancestry and elemental resilience.",
  "Wild Magic":
    "Sorcerers whose untamed magic surges unpredictably with chaotic effects.",
  "The Archfey":
    "Warlocks bound to capricious fey patrons of beguilement and trickery.",
  "The Fiend":
    "Warlocks who bargain with infernal patrons for fire and dark resilience.",
  "The Great Old One":
    "Warlocks touched by alien minds, wielding telepathy and maddening magic.",
  "School of Abjuration":
    "Wizards who specialize in protective wards and countering hostile magic.",
  "School of Conjuration":
    "Wizards who summon creatures and objects across vast distances.",
  "School of Divination":
    "Wizards who read fate and manipulate luck through portent.",
  "School of Enchantment":
    "Wizards who beguile minds and bend others to their will.",
  "School of Evocation":
    "Wizards who sculpt raw elemental energy into precise destruction.",
  "School of Illusion":
    "Wizards who weave phantasms to deceive senses and reality.",
  "School of Necromancy":
    "Wizards who command undeath and drain life force from foes.",
  "School of Transmutation":
    "Wizards who alter matter — polymorphing, alchemy, and physical change.",
};

function defaultFeatures(
  name: string,
  className: string,
  pickLevel: number,
): SubclassFeature[] {
  return [
    {
      level: pickLevel,
      name,
      description: `Core features of the ${name} ${className} subclass.`,
    },
  ];
}

export function buildSrdSubclasses(): SeedSubclass[] {
  const rows: SeedSubclass[] = [];
  for (const [className, options] of Object.entries(SUBCLASS_OPTIONS)) {
    const classSlug = CLASS_SLUGS[className] ?? slugify(className);
    const pickLevel = subclassPickLevel(className) ?? 3;
    for (const name of options) {
      rows.push({
        slug: slugify(name),
        name,
        classSlug,
        className,
        pickLevel,
        description:
          SUBCLASS_DESCRIPTIONS[name] ??
          `${name} — SRD subclass for ${className}.`,
        features: defaultFeatures(name, className, pickLevel),
      });
    }
  }
  return rows;
}

export const SRD_SUBCLASSES = buildSrdSubclasses();

export type SeedSubclassesResult = { subclasses: number };

export async function seedSubclasses(db: Database): Promise<SeedSubclassesResult> {
  await db
    .insert(codexSubclasses)
    .values(
      SRD_SUBCLASSES.map((s) => ({
        slug: s.slug,
        name: s.name,
        classSlug: s.classSlug,
        className: s.className,
        pickLevel: s.pickLevel,
        description: s.description,
        features: s.features,
        source: "srd",
        raw: {},
      })),
    )
    .onConflictDoUpdate({
      target: codexSubclasses.slug,
      set: {
        name: sql`excluded.name`,
        classSlug: sql`excluded.class_slug`,
        className: sql`excluded.class_name`,
        pickLevel: sql`excluded.pick_level`,
        description: sql`excluded.description`,
        features: sql`excluded.features`,
        source: sql`excluded.source`,
        ingestedAt: sql`now()`,
      },
    });

  const validSlugs = SRD_SUBCLASSES.map((s) => s.slug);
  if (validSlugs.length > 0) {
    await db
      .delete(codexSubclasses)
      .where(
        and(
          eq(codexSubclasses.source, "srd"),
          notInArray(codexSubclasses.slug, validSlugs),
        ),
      );
  }

  return { subclasses: SRD_SUBCLASSES.length };
}
