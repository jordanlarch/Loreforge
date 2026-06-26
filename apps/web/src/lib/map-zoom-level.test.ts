import { describe, expect, it } from "vitest";

import {
  mapLevelBadge,
  resolveCurrentMapLevel,
} from "./map-zoom-level";

describe("resolveCurrentMapLevel", () => {
  it("returns L3 for exploration", () => {
    expect(resolveCurrentMapLevel(false)).toBe(3);
  });

  it("returns L4 during combat", () => {
    expect(resolveCurrentMapLevel(true)).toBe(4);
  });
});

describe("mapLevelBadge", () => {
  it("formats level badges", () => {
    expect(mapLevelBadge(0)).toBe("L0");
    expect(mapLevelBadge(4)).toBe("L4");
  });
});
