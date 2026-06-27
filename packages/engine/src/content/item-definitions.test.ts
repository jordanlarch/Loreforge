import { describe, expect, it } from "vitest";

import {
  buildItemDefinition,
  isValidItemDefinition,
  validateItemDefinition,
  weaponSpecFromItemDefinition,
} from "./item-definitions";

describe("validateItemDefinition", () => {
  it("requires weapon stats for Weapon type", () => {
    const def = buildItemDefinition({
      name: "Mystery Blade",
      itemType: "Weapon",
      description: "",
    });
    expect(validateItemDefinition(def)).toContain(
      "Weapon items need damage dice and type.",
    );
  });

  it("accepts a valid weapon definition", () => {
    const def = buildItemDefinition({
      name: "Flame Tongue",
      itemType: "Weapon",
      description: "A fiery blade.",
      weapon: {
        damage: { dice: "1d8", type: "slashing" },
        attackBonus: 1,
        finesse: true,
      },
      equippedEffects: [
        {
          name: "Flame",
          modifier: { type: "on_hit_damage", dice: "2d6", damageType: "fire" },
        },
      ],
    });
    expect(isValidItemDefinition(def)).toBe(true);
    expect(weaponSpecFromItemDefinition(def)).toEqual({
      dice: "1d8",
      damageType: "slashing",
      attackBonus: 1,
      finesse: true,
      ranged: undefined,
      rangeFt: undefined,
    });
  });

  it("requires armor stats for Armor type", () => {
    const def = buildItemDefinition({
      name: "Plate",
      itemType: "Armor",
      description: "",
    });
    expect(validateItemDefinition(def)).toContain(
      "Armor items need a base AC.",
    );
  });

  it("accepts metadata-only gear", () => {
    const def = buildItemDefinition({
      name: "Bedroll",
      itemType: "Adventuring Gear",
      description: "For sleeping.",
    });
    expect(isValidItemDefinition(def)).toBe(true);
  });
});
