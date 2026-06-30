import { describe, expect, it } from "vitest";

import {
  classFeatureChoicesForLevel,
  featureChoiceStorageKey,
  featureChoicesCompleteForLevels,
  isFeatureChoiceComplete,
  needsFightingStyleForLevel,
  writeFeatureChoice,
} from "./class-feature-choices";

describe("classFeatureChoicesForLevel", () => {
  it("returns Cleric Divine Order at L1", () => {
    const defs = classFeatureChoicesForLevel("Cleric", 1);
    expect(defs.map((d) => d.id)).toEqual(["divine-order"]);
  });

  it("filters subclass choices by name", () => {
    const land = classFeatureChoicesForLevel("Druid", 3, "Circle of the Land");
    expect(land.some((d) => d.id === "land-terrain")).toBe(true);
    expect(
      classFeatureChoicesForLevel("Druid", 3, "Circle of the Land").some(
        (d) => d.id === "lore-bonus-skills",
      ),
    ).toBe(false);
  });
});

describe("feature choice validation", () => {
  it("requires exact multi-select count with distinct values", () => {
    const def = classFeatureChoicesForLevel("Ranger", 2).find(
      (d) => d.id === "deft-explorer-languages",
    )!;
    let choices: Record<string, string> = {};
    choices = writeFeatureChoice(choices, "Ranger", 2, def, [
      "Elvish",
      "Elvish",
    ]);
    expect(
      isFeatureChoiceComplete(choices, "Ranger", 2, def),
    ).toBe(false);
    choices = writeFeatureChoice(choices, "Ranger", 2, def, [
      "Elvish",
      "Dwarvish",
    ]);
    expect(isFeatureChoiceComplete(choices, "Ranger", 2, def)).toBe(true);
  });

  it("gates Paladin fighting style on path choice", () => {
    const pathDef = classFeatureChoicesForLevel("Paladin", 2)[0]!;
    const choices = writeFeatureChoice(
      {},
      "Paladin",
      2,
      pathDef,
      ["Blessed Warrior"],
    );
    expect(needsFightingStyleForLevel("Paladin", 2, choices)).toBe(false);
    const stylePath = writeFeatureChoice(
      {},
      "Paladin",
      2,
      pathDef,
      ["Fighting Style"],
    );
    expect(needsFightingStyleForLevel("Paladin", 2, stylePath)).toBe(true);
  });
});

describe("featureChoicesCompleteForLevels", () => {
  it("validates all levels in range", () => {
    const key = featureChoiceStorageKey("Cleric", 1, "divine-order");
    expect(
      featureChoicesCompleteForLevels(
        "Cleric",
        [1],
        { [key]: "Protector" },
        () => undefined,
      ),
    ).toBe(true);
  });
});
