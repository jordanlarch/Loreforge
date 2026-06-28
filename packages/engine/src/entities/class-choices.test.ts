import { describe, expect, it } from "vitest";

import {
  fightingStyleDescription,
  fightingStyleOnFeaturesStep,
  FIGHTING_STYLE_DESCRIPTIONS,
} from "./class-choices";

describe("fightingStyleOnFeaturesStep", () => {
  it("Fighter L1+ uses Features step; Ranger L2+ uses Advancement when starting above L1", () => {
    expect(fightingStyleOnFeaturesStep("Fighter", 1)).toBe(true);
    expect(fightingStyleOnFeaturesStep("Fighter", 5)).toBe(true);
    expect(fightingStyleOnFeaturesStep("Ranger", 5)).toBe(false);
    expect(fightingStyleOnFeaturesStep("Paladin", 5)).toBe(false);
    expect(fightingStyleOnFeaturesStep("Ranger", 1)).toBe(false);
  });
});

describe("fightingStyleDescription", () => {
  it("returns SRD text for known styles", () => {
    expect(fightingStyleDescription("Archery")).toBe(
      FIGHTING_STYLE_DESCRIPTIONS.Archery,
    );
    expect(fightingStyleDescription("Defense")).toContain("+1 bonus to AC");
  });

  it("returns undefined for unknown labels", () => {
    expect(fightingStyleDescription("Unknown")).toBeUndefined();
  });
});
