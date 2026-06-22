import { describe, expect, it } from "vitest";

import {
  blankEquipmentItem,
  blankSpell,
  groupSpellsByLevel,
  spellLevelLabel,
  totalWeight,
  type CharacterSpell,
} from "./character";

describe("blank factories", () => {
  it("creates a sane blank equipment item", () => {
    expect(blankEquipmentItem()).toEqual({
      name: "",
      quantity: 1,
      equipped: false,
    });
  });

  it("creates a blank spell at the requested level", () => {
    expect(blankSpell(3)).toEqual({ name: "", level: 3, prepared: false });
    expect(blankSpell().level).toBe(0);
  });
});

describe("totalWeight", () => {
  it("sums quantity × weight and ignores weightless items", () => {
    expect(
      totalWeight([
        { name: "Rations", quantity: 5, equipped: false, weight: 2 },
        { name: "Torch", quantity: 3, equipped: false },
        { name: "Plate", quantity: 1, equipped: true, weight: 65 },
      ]),
    ).toBe(75);
  });

  it("is zero for an empty bag", () => {
    expect(totalWeight([])).toBe(0);
  });
});

describe("groupSpellsByLevel", () => {
  const spells: CharacterSpell[] = [
    { name: "Shield", level: 1, prepared: true },
    { name: "Fire Bolt", level: 0, prepared: false },
    { name: "Burning Hands", level: 1, prepared: false },
    { name: "Mage Hand", level: 0, prepared: false },
  ];

  it("buckets by level ascending, each sorted by name", () => {
    const grouped = groupSpellsByLevel(spells);
    expect(grouped.map((g) => g.level)).toEqual([0, 1]);
    expect(grouped[0]!.spells.map((s) => s.name)).toEqual([
      "Fire Bolt",
      "Mage Hand",
    ]);
    expect(grouped[1]!.spells.map((s) => s.name)).toEqual([
      "Burning Hands",
      "Shield",
    ]);
  });
});

describe("spellLevelLabel", () => {
  it("labels cantrips and ordinal levels", () => {
    expect(spellLevelLabel(0)).toBe("Cantrips");
    expect(spellLevelLabel(1)).toBe("1st Level");
    expect(spellLevelLabel(2)).toBe("2nd Level");
    expect(spellLevelLabel(3)).toBe("3rd Level");
    expect(spellLevelLabel(5)).toBe("5th Level");
  });
});
