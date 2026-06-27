import { describe, expect, it } from "vitest";

import {
  isSpellEligibleForCharacter,
  maxCastableSpellLevel,
  spellcastingClasses,
} from "./spell-eligibility";

describe("spell eligibility", () => {
  it("lists spellcasting classes with level > 0", () => {
    expect(
      spellcastingClasses([
        { class: "Fighter", level: 5 },
        { class: "Wizard", level: 3 },
      ]),
    ).toEqual(["Wizard"]);
  });

  it("max castable level follows pooled slots", () => {
    expect(maxCastableSpellLevel([{ class: "Wizard", level: 3 }])).toBe(2);
    expect(maxCastableSpellLevel([{ class: "Wizard", level: 5 }])).toBe(3);
    expect(maxCastableSpellLevel([{ class: "Fighter", level: 5 }])).toBe(0);
  });

  it("includes warlock pact slot level", () => {
    expect(maxCastableSpellLevel([{ class: "Warlock", level: 5 }])).toBe(3);
  });

  it("gates spells by class list and level", () => {
    const wizard3 = [{ class: "Wizard", level: 3 }];
    expect(
      isSpellEligibleForCharacter(
        { level: "2", classes: ["Wizard"] },
        wizard3,
      ),
    ).toBe(true);
    expect(
      isSpellEligibleForCharacter(
        { level: "3", classes: ["Wizard"] },
        wizard3,
      ),
    ).toBe(false);
    expect(
      isSpellEligibleForCharacter(
        { level: "1", classes: ["Cleric"] },
        wizard3,
      ),
    ).toBe(false);
    expect(
      isSpellEligibleForCharacter({ level: "0", classes: ["Wizard"] }, wizard3),
    ).toBe(true);
  });
});
