import { describe, expect, it } from "vitest";

import type { AbilityScores } from "./types";
import {
  applyAbilityBonuses,
  baseArmorClass,
  isValidPointBuy,
  maxHpAtFirstLevel,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyRemaining,
  SKILLS,
  SKILL_ABILITY,
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
