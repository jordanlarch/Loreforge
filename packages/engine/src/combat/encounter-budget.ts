/**
 * Deterministic encounter difficulty budgeting (CAMP-8 / #153).
 *
 * The engine owns all combat math (Q12), so the difficulty rating of an authored
 * encounter is computed here — never by the app or the LLM. This implements the
 * DMG "Creating Encounters" procedure: sum the foes' XP, apply the encounter
 * multiplier (which scales with the number of foes and is nudged by party size),
 * then compare the adjusted total against the party's summed XP thresholds.
 *
 * Pure and side-effect free: same inputs → same rating, safe to call from a hot
 * render path.
 */

/** Difficulty bands, ascending. `unknown` = no party to measure against. */
export type EncounterDifficulty =
  | "trivial"
  | "easy"
  | "medium"
  | "hard"
  | "deadly"
  | "unknown";

/** The four DMG XP-threshold bands for a single character at a given level. */
export type XpThresholds = {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
};

/**
 * DMG per-character XP thresholds, indexed by character level (1–20).
 * Index 0 is unused (levels are 1-based).
 */
export const ENCOUNTER_XP_THRESHOLDS: readonly XpThresholds[] = [
  { easy: 0, medium: 0, hard: 0, deadly: 0 }, // 0 (unused)
  { easy: 25, medium: 50, hard: 75, deadly: 100 }, // 1
  { easy: 50, medium: 100, hard: 150, deadly: 200 }, // 2
  { easy: 75, medium: 150, hard: 225, deadly: 400 }, // 3
  { easy: 125, medium: 250, hard: 375, deadly: 500 }, // 4
  { easy: 250, medium: 500, hard: 750, deadly: 1100 }, // 5
  { easy: 300, medium: 600, hard: 900, deadly: 1400 }, // 6
  { easy: 350, medium: 750, hard: 1100, deadly: 1700 }, // 7
  { easy: 450, medium: 900, hard: 1400, deadly: 2100 }, // 8
  { easy: 550, medium: 1100, hard: 1600, deadly: 2400 }, // 9
  { easy: 600, medium: 1200, hard: 1900, deadly: 2800 }, // 10
  { easy: 800, medium: 1600, hard: 2400, deadly: 3600 }, // 11
  { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 }, // 12
  { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 }, // 13
  { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 }, // 14
  { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 }, // 15
  { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 }, // 16
  { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 }, // 17
  { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 }, // 18
  { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 }, // 19
  { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 }, // 20
];

/** DMG encounter multiplier steps, ascending by foe count band. */
const MULTIPLIER_STEPS = [1, 1.5, 2, 2.5, 3, 4] as const;

/** Map a foe count to its base index in {@link MULTIPLIER_STEPS}. */
function multiplierStepForCount(foeCount: number): number {
  if (foeCount <= 1) return 0;
  if (foeCount === 2) return 1;
  if (foeCount <= 6) return 2;
  if (foeCount <= 10) return 3;
  if (foeCount <= 14) return 4;
  return 5;
}

/** Clamp a character level into the supported 1–20 range. */
function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(20, Math.floor(level)));
}

/**
 * The DMG encounter multiplier for `foeCount` foes faced by a party of
 * `partySize`. Small parties (<3) shift one step harder; large parties (≥6)
 * shift one step easier.
 */
export function encounterMultiplier(
  foeCount: number,
  partySize: number,
): number {
  if (foeCount <= 0) return 1;
  let step = multiplierStepForCount(foeCount);
  if (partySize > 0 && partySize < 3) step += 1;
  else if (partySize >= 6) step -= 1;
  step = Math.max(0, Math.min(MULTIPLIER_STEPS.length - 1, step));
  return MULTIPLIER_STEPS[step]!;
}

/** Sum the per-band XP thresholds across every party member's level. */
export function partyThresholds(partyLevels: number[]): XpThresholds {
  return partyLevels.reduce<XpThresholds>(
    (acc, lvl) => {
      const t = ENCOUNTER_XP_THRESHOLDS[clampLevel(lvl)]!;
      return {
        easy: acc.easy + t.easy,
        medium: acc.medium + t.medium,
        hard: acc.hard + t.hard,
        deadly: acc.deadly + t.deadly,
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 },
  );
}

/** A full difficulty rating for an authored encounter. */
export type EncounterRating = {
  /** Number of individual foes (drives the multiplier). */
  foeCount: number;
  /** Raw summed foe XP, before the multiplier. */
  rawXp: number;
  /** The applied encounter multiplier. */
  multiplier: number;
  /** Multiplier-adjusted XP, compared against the party thresholds. */
  adjustedXp: number;
  /** The party's summed thresholds (zeros when the party is empty). */
  thresholds: XpThresholds;
  /** The resulting band. `unknown` when there is no party to rate against. */
  difficulty: EncounterDifficulty;
};

/**
 * Rate an encounter for a party.
 *
 * @param partyLevels one entry per party member (their total character level)
 * @param foeXps one entry per individual foe (its XP value)
 */
export function rateEncounter(
  partyLevels: number[],
  foeXps: number[],
): EncounterRating {
  const foeCount = foeXps.length;
  const rawXp = foeXps.reduce((sum, xp) => sum + xp, 0);
  const multiplier = encounterMultiplier(foeCount, partyLevels.length);
  const adjustedXp = Math.round(rawXp * multiplier);
  const thresholds = partyThresholds(partyLevels);

  let difficulty: EncounterDifficulty;
  if (partyLevels.length === 0) {
    difficulty = "unknown";
  } else if (adjustedXp < thresholds.easy) {
    difficulty = "trivial";
  } else if (adjustedXp < thresholds.medium) {
    difficulty = "easy";
  } else if (adjustedXp < thresholds.hard) {
    difficulty = "medium";
  } else if (adjustedXp < thresholds.deadly) {
    difficulty = "hard";
  } else {
    difficulty = "deadly";
  }

  return { foeCount, rawXp, multiplier, adjustedXp, thresholds, difficulty };
}
