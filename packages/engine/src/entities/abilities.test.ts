import { describe, expect, it } from "vitest";

import {
  abilityModifier,
  attacksPerAction,
  createEntityState,
  extraAttackCount,
  proficiencyBonusForLevel,
  totalLevel,
} from "./abilities";

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [8, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [18, 4],
    [20, 5],
  ])("score %i → modifier %i", (score, mod) => {
    expect(abilityModifier(score)).toBe(mod);
  });
});

describe("proficiencyBonusForLevel", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])("level %i → +%i", (level, bonus) => {
    expect(proficiencyBonusForLevel(level)).toBe(bonus);
  });
});

describe("totalLevel", () => {
  it("sums multiclass levels", () => {
    expect(
      totalLevel([
        { class: "fighter", level: 3 },
        { class: "wizard", level: 2 },
      ]),
    ).toBe(5);
  });
});

describe("createEntityState", () => {
  it("fills defaults and derives proficiency", () => {
    const entity = createEntityState({
      id: "pc:thorin",
      kind: "character",
      name: "Thorin",
      abilityScores: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 11 },
      maxHp: 34,
      baseAc: 16,
      classes: [{ class: "fighter", level: 5 }],
    });
    expect(entity.hp).toEqual({ current: 34, max: 34, temp: 0 });
    expect(entity.speed).toBe(30);
    expect(entity.proficiencyBonus).toBe(3);
    expect(entity.alive).toBe(true);
  });

  it("marks a 0-HP entity as not alive", () => {
    const entity = createEntityState({
      id: "m:rat",
      kind: "monster",
      name: "Dead Rat",
      abilityScores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
      maxHp: 0,
      baseAc: 10,
    });
    expect(entity.alive).toBe(false);
  });

  it("carries an explicit attacksPerAction override (Multiattack)", () => {
    const ogre = createEntityState({
      id: "m:ogre",
      kind: "monster",
      name: "Ogre",
      abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
      maxHp: 59,
      baseAc: 11,
      attacksPerAction: 2,
    });
    expect(ogre.attacksPerAction).toBe(2);
    expect(attacksPerAction(ogre)).toBe(2);
  });
});

describe("extraAttackCount", () => {
  it("is 1 with no Extra Attack feature", () => {
    expect(extraAttackCount([])).toBe(1);
    expect(extraAttackCount([{ class: "wizard", level: 20 }])).toBe(1);
    expect(extraAttackCount([{ class: "fighter", level: 4 }])).toBe(1);
  });

  it("grants 2 attacks to martial classes at level 5", () => {
    for (const cls of ["barbarian", "paladin", "ranger", "monk", "fighter"]) {
      expect(extraAttackCount([{ class: cls, level: 5 }])).toBe(2);
    }
  });

  it("scales the fighter to 3 at 11 and 4 at 20", () => {
    expect(extraAttackCount([{ class: "fighter", level: 11 }])).toBe(3);
    expect(extraAttackCount([{ class: "Fighter", level: 20 }])).toBe(4);
  });

  it("does not stack Extra Attack across classes (best wins)", () => {
    expect(
      extraAttackCount([
        { class: "fighter", level: 5 },
        { class: "ranger", level: 5 },
      ]),
    ).toBe(2);
  });
});

describe("attacksPerAction", () => {
  it("prefers an explicit override over class derivation", () => {
    expect(
      attacksPerAction({
        attacksPerAction: 3,
        classes: [{ class: "fighter", level: 1 }],
      }),
    ).toBe(3);
  });

  it("falls back to Extra Attack from classes", () => {
    expect(
      attacksPerAction({ classes: [{ class: "fighter", level: 11 }] }),
    ).toBe(3);
  });

  it("never returns less than 1", () => {
    expect(attacksPerAction({ attacksPerAction: 0, classes: [] })).toBe(1);
  });
});
