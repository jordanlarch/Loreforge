import { describe, expect, it } from "vitest";

import { isValidItemDefinition } from "./item-definitions";
import { open5eRawToItemDefinition } from "./open5e-item";

describe("open5eRawToItemDefinition", () => {
  it("maps an Open5e weapon row", () => {
    const def = open5eRawToItemDefinition(
      {
        weapon: {
          damage_dice: "1d8",
          damage_type: { key: "slashing", name: "Slashing" },
          properties: [
            {
              property: { name: "Versatile", type: "Property" },
              detail: "(1d10)",
            },
          ],
        },
      },
      {
        slug: "srd-2024_longsword",
        name: "Longsword",
        category: "weapon",
        description: "A longsword.",
      },
    );
    expect(def.itemType).toBe("Weapon");
    expect(def.weapon).toEqual({
      damage: { dice: "1d8", type: "slashing" },
      finesse: undefined,
      ranged: undefined,
      rangeFt: undefined,
      rangeLongFt: undefined,
      category: undefined,
      mastery: undefined,
    });
    expect(def.propertyDetails?.length).toBe(1);
    expect(isValidItemDefinition(def)).toBe(true);
  });

  it("maps ranged weapons with range detail", () => {
    const def = open5eRawToItemDefinition(
      {
        weapon: {
          damage_dice: "1d6",
          damage_type: { key: "piercing", name: "Piercing" },
          properties: [
            {
              property: { name: "Range", type: "Property" },
              detail: "80/320",
            },
            { property: { name: "Ammunition", type: "Property" } },
          ],
        },
      },
      {
        slug: "shortbow",
        name: "Shortbow",
        category: "weapon",
      },
    );
    expect(def.weapon?.ranged).toBe(true);
    expect(def.weapon?.rangeFt).toBe(80);
    expect(def.weapon?.rangeLongFt).toBe(320);
  });

  it("maps cost and weight from meta", () => {
    const def = open5eRawToItemDefinition(
      {},
      {
        slug: "crossbow-heavy",
        name: "Heavy Crossbow",
        category: "weapon",
        cost: "50",
        weight: "18",
        weightUnit: "lb",
      },
    );
    expect(def.cost).toEqual({ amount: 50, unit: "gp" });
    expect(def.weight).toEqual({ amount: 18, unit: "lb" });
  });

  it("maps armor rows", () => {
    const def = open5eRawToItemDefinition(
      {
        armor: {
          armor_class: 18,
          armor_type: { key: "heavy", name: "Heavy" },
          stealth_disadvantage: true,
        },
      },
      {
        slug: "plate",
        name: "Plate",
        category: "armor",
      },
    );
    expect(def.itemType).toBe("Armor");
    expect(def.armor).toEqual({
      baseAc: 18,
      dexBonusMax: 0,
      stealthDisadvantage: true,
      shield: undefined,
    });
    expect(isValidItemDefinition(def)).toBe(true);
  });
});
