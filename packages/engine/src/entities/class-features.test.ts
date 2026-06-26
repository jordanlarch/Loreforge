import { describe, expect, it } from "vitest";

import {
  classFeaturesForLevel,
  accumulatedClassFeatures,
} from "./class-features";

describe("classFeaturesForLevel", () => {
  it("returns Fighter level-1 features", () => {
    const features = classFeaturesForLevel("Fighter", 1);
    expect(features.map((f) => f.name)).toContain("Second Wind");
    expect(features.every((f) => f.description.length > 0)).toBe(true);
  });

  it("returns empty for levels without curated data", () => {
    expect(classFeaturesForLevel("Fighter", 4)).toEqual([]);
  });

  it("accumulates features through class level", () => {
    const all = accumulatedClassFeatures("Fighter", 2);
    expect(all.map((f) => f.name)).toEqual(
      expect.arrayContaining(["Second Wind", "Action Surge"]),
    );
  });
});
