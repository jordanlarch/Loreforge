/**
 * Build stats when creating a character above level 1 — replays HP + ASI for
 * each level 2..startingLevel using the same rules as level-up.
 */
import { abilityModifier } from "./abilities";
import {
  applyAsi,
  hpGainOnLevelUp,
  maxHpAtFirstLevel,
  xpForLevel,
  type AsiChoice,
  type HpMethod,
} from "./character-build";
import { createSeededRng } from "../rng/prng";
import type { AbilityScores } from "./types";

export type LevelAdvanceChoice = {
  level: number;
  hpMethod: HpMethod;
  asi?: AsiChoice;
  /** Feat name when taking a feat instead of ASI. */
  feat?: string;
  /** Subclass name when this level grants a subclass pick. */
  subclass?: string;
};

export function buildStartingCharacterStats(
  hitDie: number,
  startingLevel: number,
  abilityScores: AbilityScores,
  advances: LevelAdvanceChoice[],
  seedPrefix: string,
): { maxHp: number; abilityScores: AbilityScores; xp: number } {
  const level = Math.max(1, Math.min(20, Math.floor(startingLevel)));
  let scores = { ...abilityScores };
  let maxHp = maxHpAtFirstLevel(hitDie, scores.con);

  for (let l = 2; l <= level; l += 1) {
    const advance = advances.find((a) => a.level === l);
    const hpMethod: HpMethod = advance?.hpMethod ?? "average";
    const conMod = abilityModifier(scores.con);
    maxHp += hpGainOnLevelUp(hitDie, conMod, {
      mode: hpMethod,
      rng:
        hpMethod === "roll"
          ? createSeededRng(`${seedPrefix}:create:hp:${l}`)
          : undefined,
    });
    if (advance?.asi) {
      scores = applyAsi(scores, advance.asi);
    }
  }

  return {
    maxHp,
    abilityScores: scores,
    xp: xpForLevel(level),
  };
}
