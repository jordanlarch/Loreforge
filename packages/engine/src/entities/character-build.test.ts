import { describe, expect, it } from "vitest";

import { createSeededRng } from "../rng/prng";
import type { AbilityScores } from "./types";
import {
  applyAbilityBonuses,
  applyAsi,
  ASI_LEVELS,
  baseArmorClass,
  featureStubsForLevel,
  formatAsiLabel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  isValidAsiChoice,
  isValidPointBuy,
  levelForXp,
  levelUpSeed,
  maxHpAtFirstLevel,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyRemaining,
  SKILLS,
  SKILL_ABILITY,
  xpForLevel,
  xpProgress,
  STANDARD_ARRAY,
  totalPointBuyCost,
} from "./character-build";

const spread = (
  str: number,
  dex: number,
  con: number,
  int: number,
  wis: number,
  cha: number,
): AbilityScores => ({ str, dex, con, int, wis, cha });

describe("point-buy", () => {
  it("uses the 5E cost table", () => {
    expect(pointBuyCost(8)).toBe(0);
    expect(pointBuyCost(13)).toBe(5);
    expect(pointBuyCost(14)).toBe(7);
    expect(pointBuyCost(15)).toBe(9);
  });

  it("treats out-of-range scores as unaffordable", () => {
    expect(pointBuyCost(7)).toBe(Infinity);
    expect(pointBuyCost(16)).toBe(Infinity);
  });

  it("spends exactly the budget on a classic 15/15/15/8/8/8 spread", () => {
    const scores = spread(15, 15, 15, 8, 8, 8);
    expect(totalPointBuyCost(scores)).toBe(POINT_BUY_BUDGET);
    expect(pointBuyRemaining(scores)).toBe(0);
    expect(isValidPointBuy(scores)).toBe(true);
  });

  it("rejects an over-budget spread", () => {
    const scores = spread(15, 15, 15, 15, 8, 8);
    expect(totalPointBuyCost(scores)).toBeGreaterThan(POINT_BUY_BUDGET);
    expect(pointBuyRemaining(scores)).toBeLessThan(0);
    expect(isValidPointBuy(scores)).toBe(false);
  });

  it("rejects a spread with a score above the point-buy max", () => {
    expect(isValidPointBuy(spread(16, 8, 8, 8, 8, 8))).toBe(false);
  });

  it("accepts an all-10s spread within budget", () => {
    const scores = spread(10, 10, 10, 10, 10, 10);
    expect(totalPointBuyCost(scores)).toBe(12);
    expect(isValidPointBuy(scores)).toBe(true);
  });
});

describe("standard array", () => {
  it("is the canonical six values", () => {
    expect([...STANDARD_ARRAY]).toEqual([15, 14, 13, 12, 10, 8]);
  });
});

describe("skills", () => {
  it("lists all 18 SRD skills", () => {
    expect(SKILLS).toHaveLength(18);
  });

  it("maps each skill to a valid ability", () => {
    for (const skill of SKILLS) {
      expect(["str", "dex", "con", "int", "wis", "cha"]).toContain(
        SKILL_ABILITY[skill],
      );
    }
  });
});

describe("applyAbilityBonuses", () => {
  it("adds racial bonuses and leaves the base untouched", () => {
    const base = spread(15, 14, 13, 12, 10, 8);
    const result = applyAbilityBonuses(base, { con: 2, wis: 1 });
    expect(result).toEqual(spread(15, 14, 15, 12, 11, 8));
    expect(base.con).toBe(13);
  });

  it("treats missing abilities as +0", () => {
    const base = spread(10, 10, 10, 10, 10, 10);
    expect(applyAbilityBonuses(base, {})).toEqual(base);
  });
});

describe("level-1 derivations", () => {
  it("derives max HP from hit die + Con modifier", () => {
    expect(maxHpAtFirstLevel(10, 14)).toBe(12); // d10 + (+2)
    expect(maxHpAtFirstLevel(6, 8)).toBe(5); // d6 + (-1)
  });

  it("never returns less than 1 HP", () => {
    expect(maxHpAtFirstLevel(6, 1)).toBe(1); // d6 + (-5) → clamped
  });

  it("derives unarmored AC from Dex modifier", () => {
    expect(baseArmorClass(14)).toBe(12);
    expect(baseArmorClass(8)).toBe(9);
  });
});

describe("level-up HP gain", () => {
  it("uses the fixed average per hit die plus Con modifier", () => {
    expect(hpGainOnLevelUp(10, 2, { mode: "average" })).toBe(8); // 6 + 2
    expect(hpGainOnLevelUp(6, 0, { mode: "average" })).toBe(4); // 4 + 0
    expect(hpGainOnLevelUp(12, 3, { mode: "average" })).toBe(10); // 7 + 3
  });

  it("never gains less than 1 HP per level (average)", () => {
    expect(hpGainOnLevelUp(6, -5, { mode: "average" })).toBe(1); // 4 - 5 → clamped
  });

  it("rolls within the hit die range plus Con modifier", () => {
    const rng = createSeededRng("fixed-seed");
    const gain = hpGainOnLevelUp(10, 2, { mode: "roll", rng });
    expect(gain).toBeGreaterThanOrEqual(3); // 1 + 2
    expect(gain).toBeLessThanOrEqual(12); // 10 + 2
  });

  it("is deterministic for the same seed and varies by level", () => {
    const seed = levelUpSeed("char-123", 5);
    expect(hpRollFromSeed(10, 2, seed)).toBe(hpRollFromSeed(10, 2, seed));
    expect(levelUpSeed("char-123", 5)).not.toBe(levelUpSeed("char-123", 6));
  });

  it("never rolls less than 1 HP per level", () => {
    // d4 with a -10 Con mod always clamps to 1, regardless of the draw.
    expect(hpRollFromSeed(4, -10, levelUpSeed("x", 2))).toBe(1);
  });

  it("requires an rng in roll mode", () => {
    expect(() => hpGainOnLevelUp(10, 0, { mode: "roll" })).toThrow();
  });
});

describe("level-up feature stubs", () => {
  it("grants ASI at the universal levels", () => {
    for (const level of ASI_LEVELS) {
      expect(grantsAsiAtLevel("Wizard", level)).toBe(true);
    }
    expect(grantsAsiAtLevel("Wizard", 5)).toBe(false);
  });

  it("grants the class-specific extra ASI levels", () => {
    expect(grantsAsiAtLevel("Fighter", 6)).toBe(true);
    expect(grantsAsiAtLevel("Rogue", 10)).toBe(true);
    expect(grantsAsiAtLevel("Wizard", 6)).toBe(false);
  });

  it("surfaces an ASI stub plus real features at ASI levels", () => {
    const stubs = featureStubsForLevel("Fighter", 4);
    expect(stubs).toContain("Ability Score Improvement / Feat");
    expect(stubs).not.toContain("New Fighter features");
  });

  it("surfaces curated features at non-ASI levels", () => {
    expect(featureStubsForLevel("Wizard", 3)).toEqual([]);
    expect(featureStubsForLevel("Fighter", 1)).toContain("Second Wind");
  });
});

describe("asi", () => {
  it("applies +2 to one ability", () => {
    const base = spread(10, 10, 10, 10, 10, 10);
    expect(
      applyAsi(base, { mode: "increase", ability: "str", amount: 2 }),
    ).toEqual(spread(12, 10, 10, 10, 10, 10));
  });

  it("applies +1 to two abilities", () => {
    const base = spread(10, 10, 10, 10, 10, 10);
    expect(
      applyAsi(base, { mode: "split", first: "dex", second: "con" }),
    ).toEqual(spread(10, 11, 11, 10, 10, 10));
  });

  it("rejects choices that exceed 20", () => {
    expect(
      isValidAsiChoice(spread(19, 10, 10, 10, 10, 10), {
        mode: "increase",
        ability: "str",
        amount: 2,
      }),
    ).toBe(false);
  });

  it("formats ASI labels for the sheet", () => {
    expect(
      formatAsiLabel({ mode: "increase", ability: "str", amount: 2 }),
    ).toBe("+2 Strength");
    expect(
      formatAsiLabel({ mode: "split", first: "dex", second: "wis" }),
    ).toBe("+1 Dexterity, +1 Wisdom");
  });
});

describe("xp thresholds", () => {
  it("maps level → cumulative XP (5E table)", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(5)).toBe(6_500);
    expect(xpForLevel(20)).toBe(355_000);
  });

  it("clamps out-of-range levels", () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(99)).toBe(355_000);
  });

  it("derives the level a given XP total has reached", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(6_499)).toBe(4);
    expect(levelForXp(6_500)).toBe(5);
    expect(levelForXp(10_000_000)).toBe(20);
  });

  it("reports progress toward the next level and gates level-up", () => {
    const mid = xpProgress(450, 2); // band 300→900, halfway
    expect(mid.nextLevel).toBe(3);
    expect(mid.floor).toBe(300);
    expect(mid.ceiling).toBe(900);
    expect(mid.remaining).toBe(450);
    expect(mid.fraction).toBeCloseTo(0.25);
    expect(mid.canLevelUp).toBe(false);

    const ready = xpProgress(900, 2);
    expect(ready.canLevelUp).toBe(true);
    expect(ready.remaining).toBe(0);
  });

  it("caps progress at level 20", () => {
    const capped = xpProgress(500_000, 20);
    expect(capped.nextLevel).toBeNull();
    expect(capped.ceiling).toBeNull();
    expect(capped.remaining).toBeNull();
    expect(capped.fraction).toBe(1);
    expect(capped.canLevelUp).toBe(false);
  });
});
