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
