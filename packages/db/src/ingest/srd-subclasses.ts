/**
 * Curated SRD subclass records for Codex browse + character creation (CODEX-SUBCLASSES).
 * SRD 5.2 (2024) — one official subclass per class.
 */
import { notInArray, sql } from "drizzle-orm";

import {
  SUBCLASS_OPTIONS,
  subclassPickLevel,
} from "@app/engine";

import type { Database } from "../client";
import { codexSubclasses, type SubclassFeature } from "../schema/codex";
import { SRD_SUBCLASS_FEATURES } from "./srd-subclass-features";

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

/** One-line SRD 5.2 summaries keyed by subclass display name. */
const SUBCLASS_DESCRIPTIONS: Record<string, string> = {
  "Path of the Berserker":
    "Barbarians who channel rage into reckless fury, gaining Frenzy and brutal retaliation.",
  "College of Lore":
    "Bards who collect secrets and lore, gaining extra skills and cutting words.",
  "Life Domain":
    "Clerics devoted to preserving life, with superior healing and protective magic.",
  "Circle of the Land":
    "Druids tied to a terrain whose magic reflects their chosen land's essence.",
  Champion:
    "Fighters focused on raw athletic excellence — critical hits and physical prowess.",
  "Warrior of the Open Hand":
    "Monks who manipulate ki for stunning strikes and defensive mastery.",
  "Oath of Devotion":
    "Paladins who uphold honor, protection, and radiant justice.",
  Hunter:
    "Rangers specialized in slaying specific threats with tactical superiority.",
  Thief:
    "Rogues skilled in larceny, climbing, and using magic items quickly.",
  "Draconic Sorcery":
    "Sorcerers whose magic stems from draconic ancestry and elemental resilience.",
  "Fiend Patron":
    "Warlocks who bargain with infernal patrons for fire and dark resilience.",
  Evoker:
    "Wizards who sculpt raw elemental energy into precise destruction.",
};

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
        features:
          SRD_SUBCLASS_FEATURES[name] ??
          [
            {
              level: pickLevel,
              name,
              description: `Core features of the ${name} ${className} subclass.`,
            },
          ],
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
      .where(notInArray(codexSubclasses.slug, validSlugs));
  }

  return { subclasses: SRD_SUBCLASSES.length };
}
