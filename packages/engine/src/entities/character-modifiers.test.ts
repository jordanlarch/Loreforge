import { describe, expect, it } from "vitest";

import {
  effectiveArmorClass,
  featModifiers,
  fightingStyleModifiers,
} from "./character-modifiers";

describe("fightingStyleModifiers", () => {
  it("grants +1 AC for Defense in armor", () => {
    expect(
      fightingStyleModifiers("Fighter", "Defense", {
        wearingArmor: true,
        oneHandedMelee: false,
        ranged: false,
      }).acBonus,
    ).toBe(1);
  });

  it("grants +2 ranged attack for Archery", () => {
    expect(
      fightingStyleModifiers("Fighter", "Archery", {
        wearingArmor: false,
        oneHandedMelee: false,
        ranged: true,
      }).rangedAttackBonus,
    ).toBe(2);
  });

  it("grants +2 melee damage for Dueling with one-handed weapon", () => {
    expect(
      fightingStyleModifiers("Fighter", "Dueling", {
        wearingArmor: false,
        oneHandedMelee: true,
        ranged: false,
      }).meleeDamageBonus,
    ).toBe(2);
  });
});

describe("featModifiers", () => {
  it("Alert adds +5 initiative", () => {
    expect(featModifiers(["Alert"]).initiativeBonus).toBe(5);
  });
});

describe("effectiveArmorClass", () => {
  it("sums base and bonus", () => {
    expect(effectiveArmorClass(18, 1)).toBe(19);
  });
});
