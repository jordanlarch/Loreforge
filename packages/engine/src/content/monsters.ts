/**
 * A tiny bestiary of foe templates for authored encounters (CAMP-8 / #115).
 *
 * The encounter authoring flow stores foes by `template` slug + count; the live
 * room expands each into engine `create_entity` commands. Keeping the statlines
 * here (rather than in the app or the WS layer) means both the encounter form
 * and the deterministic seed read one source of truth, and the enemy-AI attack
 * profile (`monsterAttackProfile`) derives believable attacks from real ability
 * scores. This is intentionally a small curated set, not the full SRD bestiary
 * (that rides the content-ingest track); add rows as encounters need them.
 */
import type { AbilityScores } from "../entities/types";

/** A reusable monster statline placed into an encounter. */
export type MonsterTemplate = {
  /** Stable identifier stored on the encounter's foe rows. */
  slug: string;
  /** Display name (a count suffix is appended when more than one is fielded). */
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
  /** Challenge Rating label (e.g. "1/4", "2"). Display + provenance only. */
  cr: string;
  /** Experience-point value used for encounter difficulty budgeting (DMG). */
  xp: number;
};

/** The curated foe templates, keyed by slug. */
export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  goblin: {
    slug: "goblin",
    name: "Goblin",
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    maxHp: 7,
    baseAc: 15,
    speed: 30,
    cr: "1/4",
    xp: 50,
  },
  orc: {
    slug: "orc",
    name: "Orc",
    abilityScores: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    maxHp: 15,
    baseAc: 13,
    speed: 30,
    cr: "1/2",
    xp: 100,
  },
  wolf: {
    slug: "wolf",
    name: "Wolf",
    abilityScores: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    maxHp: 11,
    baseAc: 13,
    speed: 40,
    cr: "1/4",
    xp: 50,
  },
  skeleton: {
    slug: "skeleton",
    name: "Skeleton",
    abilityScores: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    maxHp: 13,
    baseAc: 13,
    speed: 30,
    cr: "1/4",
    xp: 50,
  },
  bandit: {
    slug: "bandit",
    name: "Bandit",
    abilityScores: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    maxHp: 11,
    baseAc: 12,
    speed: 30,
    cr: "1/8",
    xp: 25,
  },
  ogre: {
    slug: "ogre",
    name: "Ogre",
    abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    maxHp: 59,
    baseAc: 11,
    speed: 40,
    cr: "2",
    xp: 450,
  },
};

/** The catalog as an ordered list (form dropdowns, iteration). */
export const MONSTER_TEMPLATE_LIST: readonly MonsterTemplate[] =
  Object.values(MONSTER_TEMPLATES);

/** Look up a template by slug, or `undefined` for an unknown slug. */
export function monsterTemplate(slug: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES[slug];
}
