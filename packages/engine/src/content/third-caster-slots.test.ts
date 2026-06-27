import { describe, expect, it } from "vitest";

import {
  hasThirdCasterSlots,
  thirdCasterSlotMaxima,
} from "./third-caster-slots";

describe("thirdCasterSlotMaxima", () => {
  it("grants 2 first-level slots at Fighter 3 EK", () => {
    expect(
      thirdCasterSlotMaxima([
        { class: "Fighter", level: 3, subclass: "Eldritch Knight" },
      ]),
    ).toEqual({ "1": 2 });
  });

  it("adds second-level slots at level 7", () => {
    expect(
      thirdCasterSlotMaxima([
        { class: "Fighter", level: 7, subclass: "Eldritch Knight" },
      ]),
    ).toEqual({ "1": 2, "2": 2 });
  });

  it("detects Arcane Trickster", () => {
    expect(
      hasThirdCasterSlots([
        { class: "Rogue", level: 3, subclass: "Arcane Trickster" },
      ]),
    ).toBe(true);
  });
});
