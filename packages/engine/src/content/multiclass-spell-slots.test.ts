import { describe, expect, it } from "vitest";

import {
  multiclassCasterLevel,
  sheetSlotPoolsFromClasses,
  spellSlotsForClasses,
} from "./multiclass-spell-slots";

describe("multiclass spell slots", () => {
  it("sums full caster levels", () => {
    expect(
      multiclassCasterLevel([
        { class: "Wizard", level: 3 },
        { class: "Cleric", level: 2 },
      ]),
    ).toBe(5);
    expect(spellSlotsForClasses([{ class: "Wizard", level: 5 }])[3]?.max).toBe(2);
  });

  it("counts half casters at half level rounded down", () => {
    expect(
      multiclassCasterLevel([
        { class: "Wizard", level: 3 },
        { class: "Paladin", level: 3 },
      ]),
    ).toBe(4);
  });

  it("exports sheet slot pools with used at zero", () => {
    const pools = sheetSlotPoolsFromClasses([{ class: "Wizard", level: 3 }]);
    expect(pools["1"]).toEqual({ max: 4, used: 0 });
    expect(pools["2"]).toEqual({ max: 2, used: 0 });
  });
});
