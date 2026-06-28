import { describe, expect, it } from "vitest";

import { buildItemDefinition } from "@app/engine";

import { effectiveSheetVitals } from "./sheet-modifiers";

describe("effectiveSheetVitals armor derivation", () => {
  const chain = buildItemDefinition({
    name: "Chain Mail",
    itemType: "Armor",
    description: "Medium armor.",
    armor: { baseAc: 16, dexBonusMax: 2 },
  });

  it("uses derived AC from equipped Smithy armor", () => {
    const vitals = effectiveSheetVitals(
      {
        id: "c1",
        name: "Test",
        species: "Human",
        background: "Soldier",
        classes: [{ class: "Fighter", level: 1 }],
        abilityScores: {
          str: 15,
          dex: 16,
          con: 14,
          int: 10,
          wis: 12,
          cha: 8,
        },
        maxHp: 12,
        baseAc: 10,
        speed: 30,
        saveProficiencies: ["str", "con"],
        skillProficiencies: ["Athletics"],
        equipment: [
          {
            name: "Chain Mail",
            equipped: true,
            quantity: 1,
            smithyItemId: "armor-1",
          },
        ],
      },
      { feats: [], fightingStyles: {} },
      { smithyDefinitions: { "armor-1": chain } },
    );
    expect(vitals.ac).toBe(18);
    expect(vitals.derivedAc.source).toBe("derived");
  });

  it("uses derived AC from equipped Codex armor", () => {
    const plate = buildItemDefinition({
      name: "Plate Armor",
      itemType: "Armor",
      description: "Heavy armor.",
      armor: { baseAc: 18, dexBonusMax: 0 },
    });
    const vitals = effectiveSheetVitals(
      {
        id: "c1",
        name: "Test",
        species: "Human",
        background: "Soldier",
        classes: [{ class: "Fighter", level: 1 }],
        abilityScores: {
          str: 15,
          dex: 10,
          con: 14,
          int: 10,
          wis: 12,
          cha: 8,
        },
        maxHp: 12,
        baseAc: 10,
        speed: 30,
        saveProficiencies: ["str", "con"],
        skillProficiencies: ["Athletics"],
        equipment: [
          {
            name: "Plate Armor",
            equipped: true,
            quantity: 1,
            codexSlug: "plate-armor",
          },
        ],
      },
      { feats: [], fightingStyles: {} },
      { codexDefinitions: { "plate-armor": plate } },
    );
    expect(vitals.ac).toBe(18);
    expect(vitals.derivedAc.source).toBe("derived");
  });
});
