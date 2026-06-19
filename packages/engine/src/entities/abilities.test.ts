import { describe, expect, it } from "vitest";

import {
  abilityModifier,
  createEntityState,
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
});
