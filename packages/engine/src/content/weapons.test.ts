import { describe, expect, it } from "vitest";

import {
  meleeReachFromEquipment,
  meleeReachFromWeaponName,
} from "./weapons";

describe("meleeReachFromWeaponName", () => {
  it("recognizes reach weapons", () => {
    expect(meleeReachFromWeaponName("Glaive")).toBe(10);
    expect(meleeReachFromWeaponName("+1 Halberd")).toBe(10);
  });

  it("returns undefined for standard melee weapons", () => {
    expect(meleeReachFromWeaponName("Longsword")).toBeUndefined();
  });
});

describe("meleeReachFromEquipment", () => {
  it("picks the longest equipped reach", () => {
    expect(
      meleeReachFromEquipment([
        { name: "Longsword", quantity: 1, equipped: true },
        { name: "Halberd", quantity: 1, equipped: true },
      ]),
    ).toBe(10);
  });

  it("ignores unequipped or empty-quantity items", () => {
    expect(
      meleeReachFromEquipment([
        { name: "Halberd", quantity: 1, equipped: false },
        { name: "Glaive", quantity: 0, equipped: true },
      ]),
    ).toBeUndefined();
  });
});
