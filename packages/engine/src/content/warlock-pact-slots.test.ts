import { describe, expect, it } from "vitest";

import {
  warlockLevelFromClasses,
  warlockPactMagic,
} from "./warlock-pact-slots";

describe("warlockPactMagic", () => {
  it("returns one 1st-level slot at warlock 1", () => {
    expect(warlockPactMagic(1)).toEqual({ max: 1, used: 0, slotLevel: 1 });
  });

  it("returns two 1st-level slots at warlock 2", () => {
    expect(warlockPactMagic(2)).toEqual({ max: 2, used: 0, slotLevel: 1 });
  });

  it("returns two 3rd-level slots at warlock 5", () => {
    expect(warlockPactMagic(5)).toEqual({ max: 2, used: 0, slotLevel: 3 });
  });

  it("reads warlock level from class list", () => {
    expect(
      warlockLevelFromClasses([
        { class: "Fighter", level: 5 },
        { class: "Warlock", level: 3 },
      ]),
    ).toBe(3);
  });
});
