/**
 * Pure 5E character-creation helpers used by the Creation Wizard (#6).
 *
 * Everything here is deterministic and state-free: ability-score generation
 * methods (point-buy / standard array / manual), the SRD skill list, racial
 * ability-bonus application, and the level-1 HP/AC derivations the wizard needs
 * to assemble a valid `characters.create` payload. Keeping these in the engine
 * (not the React layer) honours the deterministic-engine decision — the app
 * only collects choices; the engine owns the math.
 */
import { rollDice } from "../rng/dice";
import { createSeededRng, type Rng } from "../rng/prng";
import { abilityModifier } from "./abilities";
import type { Ability, AbilityScores } from "./types";
import { ABILITIES } from "./types";

/** The 5E "standard array" of ability scores, highest first. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Point-buy budget (5E default). */
export const POINT_BUY_BUDGET = 27;
/** Lowest score purchasable via point-buy. */
export const POINT_BUY_MIN = 8;
/** Highest score purchasable via point-buy (before racial bonuses). */
export const POINT_BUY_MAX = 15;

/** Inclusive bounds for manual ability-score entry (before racial bonuses). */
export const MANUAL_MIN = 3;
export const MANUAL_MAX = 18;

/** Point-buy cost per ability score (5E table). */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/**
 * Cost of a single ability score under point-buy. Scores outside the
 * purchasable [8, 15] range return `Infinity` so any total including them fails
 * the budget check.
 */
export function pointBuyCost(score: number): number {
  return POINT_BUY_COST[score] ?? Infinity;
}

/** Total point-buy cost of a full ability spread. */
export function totalPointBuyCost(scores: AbilityScores): number {
  return ABILITIES.reduce((sum, a) => sum + pointBuyCost(scores[a]), 0);
}

/** Points still available under the point-buy budget (negative = over-budget). */
export function pointBuyRemaining(scores: AbilityScores): number {
  return POINT_BUY_BUDGET - totalPointBuyCost(scores);
}

/**
 * Whether a spread is a legal point-buy: every score in [8, 15] and total cost
 * within budget. Used to block illegal combos before submit.
 */
export function isValidPointBuy(scores: AbilityScores): boolean {
  return (
    ABILITIES.every(
      (a) => scores[a] >= POINT_BUY_MIN && scores[a] <= POINT_BUY_MAX,
    ) && totalPointBuyCost(scores) <= POINT_BUY_BUDGET
  );
}

/** The 18 SRD skills mapped to their governing ability. */
export const SKILL_ABILITY = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
} as const satisfies Record<string, Ability>;

export type Skill = keyof typeof SKILL_ABILITY;

/** All SRD skill names, alphabetical. */
export const SKILLS = Object.keys(SKILL_ABILITY) as Skill[];

/**
 * Apply racial/species ability bonuses to a base spread. Missing abilities in
 * `bonuses` contribute 0. Pure — returns a new spread.
 */
export function applyAbilityBonuses(
  base: AbilityScores,
  bonuses: Partial<AbilityScores>,
): AbilityScores {
  return ABILITIES.reduce(
    (acc, a) => ({ ...acc, [a]: base[a] + (bonuses[a] ?? 0) }),
    {} as AbilityScores,
  );
}

/**
 * Maximum HP at level 1: full hit die + Constitution modifier (minimum 1).
 * Standard 5E first-level rule (max hit die rather than rolled).
 */
export function maxHpAtFirstLevel(hitDie: number, conScore: number): number {
  return Math.max(1, hitDie + abilityModifier(conScore));
}

/** Unarmored base AC: 10 + Dexterity modifier. */
export function baseArmorClass(dexScore: number): number {
  return 10 + abilityModifier(dexScore);
}

/** How a level-up's hit points are determined (see {@link hpGainOnLevelUp}). */
export type HpMethod = "average" | "roll";

/**
 * Deterministic seed string for a level-up HP roll. Keyed by character id and
 * the *new* total level so every roll is reproducible (same character + same
 * level always yields the same hit-die result) and the client can preview the
 * exact value the server will persist. There is no reroll in v1.
 */
export function levelUpSeed(characterId: string, newLevel: number): string {
  return `${characterId}:levelup:${newLevel}`;
}

/**
 * Hit points gained when advancing one class level (5E).
 *
 * - `average`: the fixed per-level value `floor(hitDie / 2) + 1` plus the Con
 *   modifier (e.g. d10 → 6 before Con).
 * - `roll`: a single `1d{hitDie}` drawn from the provided seeded {@link Rng}
 *   (engine-owned randomness — never `Math.random`), plus the Con modifier.
 *
 * Always clamped to a minimum of 1 HP per level, per the 5E rule. `roll`
 * requires an `rng`; callers pass one seeded via {@link levelUpSeed}.
 */
export function hpGainOnLevelUp(
  hitDie: number,
  conMod: number,
  opts: { mode: HpMethod; rng?: Rng },
): number {
  if (opts.mode === "average") {
    return Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  }
  if (!opts.rng) {
    throw new Error("hpGainOnLevelUp: roll mode requires a seeded rng");
  }
  const rolled = rollDice(`1d${hitDie}`, opts.rng).total;
  return Math.max(1, rolled + conMod);
}

/**
 * Convenience wrapper: roll level-up HP from a deterministic seed string
 * (see {@link levelUpSeed}). Equivalent to calling {@link hpGainOnLevelUp} with
 * `createSeededRng(seed)`.
 */
export function hpRollFromSeed(
  hitDie: number,
  conMod: number,
  seed: string,
): number {
  return hpGainOnLevelUp(hitDie, conMod, {
    mode: "roll",
    rng: createSeededRng(seed),
  });
}

/** Universal levels that grant an Ability Score Improvement (5E). */
export const ASI_LEVELS = [4, 8, 12, 16, 19] as const;

/** Extra ASI levels granted by specific classes beyond the universal ones. */
const EXTRA_ASI_LEVELS: Record<string, number[]> = {
  Fighter: [6, 14],
  Rogue: [10],
};

/** Whether a class gains an ASI/feat choice at the given level. */
export function grantsAsiAtLevel(className: string, level: number): boolean {
  return (
    (ASI_LEVELS as readonly number[]).includes(level) ||
    (EXTRA_ASI_LEVELS[className]?.includes(level) ?? false)
  );
}

/**
 * Stub labels for the choices a class gains at a given level.
 *
 * Scaffolding only (#11): we surface *that* a choice exists ("Ability Score
 * Improvement", generic new class features) without wiring the real ASI/feat or
 * per-class feature data — full feature ingestion + selection UI is a follow-up.
 */
export function featureStubsForLevel(
  className: string,
  level: number,
): string[] {
  const stubs: string[] = [];
  if (grantsAsiAtLevel(className, level)) {
    stubs.push("Ability Score Improvement / Feat");
  }
  stubs.push(`New ${className} features`);
  return stubs;
}
