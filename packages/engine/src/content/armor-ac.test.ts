import { describe, expect, it } from "vitest";

import { buildItemDefinition } from "./item-definitions";
import { deriveEquippedArmorClass } from "./armor-ac";

describe("deriveEquippedArmorClass", () => {
  const chain = buildItemDefinition({
    name: "Chain Mail",
    itemType: "Armor",
    description: "Medium armor.",
    armor: { baseAc: 16, dexBonusMax: 2 },
  });
  const shield = buildItemDefinition({
    name: "Shield",
    itemType: "Armor",
    description: "Shield.",
    armor: { baseAc: 2, shield: true },
  });

  it("falls back to stored baseAc without smithy armor", () => {
    const result = deriveEquippedArmorClass({
      dexScore: 14,
      storedBaseAc: 18,
      equipment: [{ name: "Cloak", equipped: true, quantity: 1 }],
      itemDefinitions: {},
    });
    expect(result).toEqual({ ac: 18, source: "stored" });
  });

  it("derives medium armor + DEX cap", () => {
    const result = deriveEquippedArmorClass({
      dexScore: 16,
      storedBaseAc: 10,
      equipment: [
        {
          name: "Chain Mail",
          equipped: true,
          quantity: 1,
          smithyItemId: "armor-1",
        },
      ],
      itemDefinitions: { "armor-1": chain },
    });
    expect(result).toEqual({ ac: 18, source: "derived" });
  });

  it("stacks shield on derived body armor", () => {
    const result = deriveEquippedArmorClass({
      dexScore: 10,
      storedBaseAc: 10,
      equipment: [
        {
          name: "Chain Mail",
          equipped: true,
          quantity: 1,
          smithyItemId: "armor-1",
        },
        {
          name: "Shield",
          equipped: true,
          quantity: 1,
          smithyItemId: "shield-1",
        },
      ],
      itemDefinitions: { "armor-1": chain, "shield-1": shield },
    });
    expect(result).toEqual({ ac: 18, source: "derived" });
  });

  it("shield only uses unarmored base + 2", () => {
    const result = deriveEquippedArmorClass({
      dexScore: 14,
      storedBaseAc: 16,
      equipment: [
        {
          name: "Shield",
          equipped: true,
          quantity: 1,
          smithyItemId: "shield-1",
        },
      ],
      itemDefinitions: { "shield-1": shield },
    });
    expect(result).toEqual({ ac: 14, source: "derived" });
  });
});
