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
import { classFeaturesForLevel } from "./class-features";
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

/**
 * Cumulative XP required to reach each character level (5E DMG table), indexed
 * by level. `XP_THRESHOLDS[1] === 0`; index 0 is a placeholder so the array is
 * 1-based. The cap is level 20.
 */
export const XP_THRESHOLDS = [
  0, // index 0 (unused — levels are 1-based)
  0, // 1
  300, // 2
  900, // 3
  2_700, // 4
  6_500, // 5
  14_000, // 6
  23_000, // 7
  34_000, // 8
  48_000, // 9
  64_000, // 10
  85_000, // 11
  100_000, // 12
  120_000, // 13
  140_000, // 14
  165_000, // 15
  195_000, // 16
  225_000, // 17
  265_000, // 18
  305_000, // 19
  355_000, // 20
] as const;

/** The character-level cap (5E). */
export const MAX_CHARACTER_LEVEL = 20;

/** Cumulative XP required to reach `level` (clamped to [1, 20]). */
export function xpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.floor(level)));
  return XP_THRESHOLDS[clamped]!;
}

/** The highest level whose XP threshold `xp` has reached (1–20). */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l <= MAX_CHARACTER_LEVEL; l += 1) {
    if (xp >= XP_THRESHOLDS[l]!) level = l;
    else break;
  }
  return level;
}

/**
 * XP-gated level-up state for a character at `currentLevel` with `xp` points.
 * `canLevelUp` is true once `xp` reaches the threshold for the next level. The
 * fraction/remaining drive a progress bar toward the next level.
 */
export function xpProgress(
  xp: number,
  currentLevel: number,
): {
  currentLevel: number;
  nextLevel: number | null;
  /** Cumulative XP at the start of the current level band. */
  floor: number;
  /** Cumulative XP needed for the next level (null at the cap). */
  ceiling: number | null;
  /** XP still needed to reach the next level (0 once eligible; null at cap). */
  remaining: number | null;
  /** Progress through the current band in [0, 1] (1 at the cap). */
  fraction: number;
  canLevelUp: boolean;
} {
  const level = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, currentLevel));
  const floor = xpForLevel(level);
  if (level >= MAX_CHARACTER_LEVEL) {
    return {
      currentLevel: level,
      nextLevel: null,
      floor,
      ceiling: null,
      remaining: null,
      fraction: 1,
      canLevelUp: false,
    };
  }
  const ceiling = xpForLevel(level + 1);
  const span = ceiling - floor;
  const into = Math.max(0, xp - floor);
  const fraction = span <= 0 ? 1 : Math.max(0, Math.min(1, into / span));
  return {
    currentLevel: level,
    nextLevel: level + 1,
    floor,
    ceiling,
    remaining: Math.max(0, ceiling - xp),
    fraction,
    canLevelUp: xp >= ceiling,
  };
}

/** Universal levels that grant an Ability Score Improvement (5E). */
export const ASI_LEVELS = [4, 8, 12, 16, 19] as const;

/** Extra ASI levels granted by specific classes beyond the universal ones. */
const EXTRA_ASI_LEVELS: Record<string, number[]> = {
  Fighter: [6, 14],
  Rogue: [10],
};

/** Primary spellcasting ability by SRD class display name (null = non-caster). */
export const CLASS_SPELLCASTING_ABILITY: Partial<Record<string, Ability>> = {
  Bard: "cha",
  Cleric: "wis",
  Druid: "wis",
  Paladin: "cha",
  Ranger: "wis",
  Sorcerer: "cha",
  Warlock: "cha",
  Wizard: "int",
};

/**
 * Spellcasting ability for a character's class list. Uses the highest-level
 * class that can cast; ties break toward the first entry in `classes`.
 */
export function spellcastingAbilityForClasses(
  classes: { class: string; level: number }[],
): Ability | null {
  let best: { class: string; level: number } | null = null;
  for (const cl of classes) {
    if (!CLASS_SPELLCASTING_ABILITY[cl.class]) continue;
    if (!best || cl.level > best.level) best = cl;
  }
  return best ? (CLASS_SPELLCASTING_ABILITY[best.class] ?? null) : null;
}

/** Whether a class gains an ASI/feat choice at the given level. */
export function grantsAsiAtLevel(className: string, level: number): boolean {
  return (
    (ASI_LEVELS as readonly number[]).includes(level) ||
    (EXTRA_ASI_LEVELS[className]?.includes(level) ?? false)
  );
}

/** ASI choice at level-up: +2 to one ability or +1 to two (5E). Feat choice deferred. */
export type AsiChoice =
  | { mode: "increase"; ability: Ability; amount: 2 }
  | { mode: "split"; first: Ability; second: Ability };

const MAX_ABILITY_SCORE = 20;

/** Whether an ASI choice is legal under 5E (+2 one or +1 two, cap 20). */
export function isValidAsiChoice(
  scores: AbilityScores,
  choice: AsiChoice,
): boolean {
  if (choice.mode === "increase") {
    return choice.amount === 2 && scores[choice.ability] + 2 <= MAX_ABILITY_SCORE;
  }
  if (choice.first === choice.second) return false;
  return (
    scores[choice.first] + 1 <= MAX_ABILITY_SCORE &&
    scores[choice.second] + 1 <= MAX_ABILITY_SCORE
  );
}

const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Human-readable label for an ASI choice on the character sheet. */
export function formatAsiLabel(choice: AsiChoice): string {
  if (choice.mode === "increase") {
    return `+${choice.amount} ${ABILITY_NAMES[choice.ability]}`;
  }
  return `+1 ${ABILITY_NAMES[choice.first]}, +1 ${ABILITY_NAMES[choice.second]}`;
}

/** Apply an ASI to a spread; throws if the choice would exceed the cap. */
export function applyAsi(
  scores: AbilityScores,
  choice: AsiChoice,
): AbilityScores {
  if (!isValidAsiChoice(scores, choice)) {
    throw new Error("Invalid ASI choice for current ability scores.");
  }
  if (choice.mode === "increase") {
    return {
      ...scores,
      [choice.ability]: scores[choice.ability] + choice.amount,
    };
  }
  return {
    ...scores,
    [choice.first]: scores[choice.first] + 1,
    [choice.second]: scores[choice.second] + 1,
  };
}

/**
 * SRD 2024 background ability score increase: +2/+1 to two abilities, or +1
 * to three different abilities (Character Origins, p.83).
 */
export type BackgroundAsiChoice =
  | { mode: "boost"; primary: Ability; secondary: Ability }
  | { mode: "triple"; first: Ability; second: Ability; third: Ability };

/** Whether a background ASI choice is legal (distinct abilities, cap 20). */
export function isValidBackgroundAsiChoice(
  scores: AbilityScores,
  choice: BackgroundAsiChoice,
): boolean {
  if (choice.mode === "boost") {
    if (choice.primary === choice.secondary) return false;
    return (
      scores[choice.primary] + 2 <= MAX_ABILITY_SCORE &&
      scores[choice.secondary] + 1 <= MAX_ABILITY_SCORE
    );
  }
  const { first, second, third } = choice;
  if (first === second || first === third || second === third) return false;
  return (
    scores[first] + 1 <= MAX_ABILITY_SCORE &&
    scores[second] + 1 <= MAX_ABILITY_SCORE &&
    scores[third] + 1 <= MAX_ABILITY_SCORE
  );
}

/** Per-ability bonus totals from a background ASI choice (for wizard display). */
export function backgroundAsiBonuses(
  choice: BackgroundAsiChoice,
): Partial<AbilityScores> {
  const bonuses: Partial<AbilityScores> = {};
  if (choice.mode === "boost") {
    bonuses[choice.primary] = (bonuses[choice.primary] ?? 0) + 2;
    bonuses[choice.secondary] = (bonuses[choice.secondary] ?? 0) + 1;
  } else {
    bonuses[choice.first] = (bonuses[choice.first] ?? 0) + 1;
    bonuses[choice.second] = (bonuses[choice.second] ?? 0) + 1;
    bonuses[choice.third] = (bonuses[choice.third] ?? 0) + 1;
  }
  return bonuses;
}

export function formatBackgroundAsiLabel(choice: BackgroundAsiChoice): string {
  if (choice.mode === "boost") {
    return `+2 ${ABILITY_NAMES[choice.primary]}, +1 ${ABILITY_NAMES[choice.secondary]}`;
  }
  return `+1 ${ABILITY_NAMES[choice.first]}, +1 ${ABILITY_NAMES[choice.second]}, +1 ${ABILITY_NAMES[choice.third]}`;
}

/** Apply a background ASI to a spread; throws if the choice would exceed the cap. */
export function applyBackgroundAsi(
  scores: AbilityScores,
  choice: BackgroundAsiChoice,
): AbilityScores {
  if (!isValidBackgroundAsiChoice(scores, choice)) {
    throw new Error("Invalid background ASI choice for current ability scores.");
  }
  const next = { ...scores };
  for (const [ability, amount] of Object.entries(backgroundAsiBonuses(choice)) as [
    Ability,
    number,
  ][]) {
    next[ability] += amount;
  }
  return next;
}

/**
 * Labels for features gained at a class level (real SRD names + ASI when applicable).
 */
export function featureStubsForLevel(
  className: string,
  level: number,
): string[] {
  const stubs: string[] = [];
  if (grantsAsiAtLevel(className, level)) {
    stubs.push("Ability Score Improvement / Feat");
  }
  stubs.push(...classFeaturesForLevel(className, level).map((f) => f.name));
  return stubs;
}
