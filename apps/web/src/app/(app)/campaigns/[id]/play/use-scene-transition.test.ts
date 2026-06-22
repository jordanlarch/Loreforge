import { describe, expect, it } from "vitest";

import { isSceneChange } from "./use-scene-transition";

describe("isSceneChange", () => {
  it("is true only when both ids are known and differ", () => {
    expect(isSceneChange("tavern", "woods")).toBe(true);
  });

  it("ignores the initial load (no previous scene)", () => {
    expect(isSceneChange(undefined, "tavern")).toBe(false);
  });

  it("ignores leaving to an unknown scene", () => {
    expect(isSceneChange("tavern", undefined)).toBe(false);
  });

  it("is false when the scene is unchanged", () => {
    expect(isSceneChange("tavern", "tavern")).toBe(false);
  });
});
