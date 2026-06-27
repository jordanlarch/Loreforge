import { describe, expect, it } from "vitest";

import {
  meetsMulticlassRequirement,
  multiclassEligible,
  multiclassIneligibilityReason,
} from "./multiclass-requirements";

const fighterScores = {
  str: 15,
  dex: 10,
  con: 14,
  int: 8,
  wis: 12,
  cha: 10,
};

describe("multiclass requirements", () => {
  it("accepts fighter with STR 13+", () => {
    expect(meetsMulticlassRequirement("Fighter", fighterScores)).toBe(true);
  });

  it("accepts fighter with DEX 13+ instead of STR", () => {
    expect(
      meetsMulticlassRequirement("Fighter", {
        ...fighterScores,
        str: 10,
        dex: 14,
      }),
    ).toBe(true);
  });

  it("rejects wizard without INT 13+", () => {
    expect(meetsMulticlassRequirement("Wizard", fighterScores)).toBe(false);
  });

  it("requires every class on the sheet to qualify", () => {
    expect(
      multiclassEligible(["Fighter", "Wizard"], {
        ...fighterScores,
        int: 14,
      }),
    ).toBe(true);
    expect(
      multiclassEligible(["Fighter", "Wizard"], fighterScores),
    ).toBe(false);
  });

  it("returns a readable failure reason", () => {
    expect(
      multiclassIneligibilityReason(["Fighter", "Wizard"], fighterScores),
    ).toContain("Wizard");
  });
});
