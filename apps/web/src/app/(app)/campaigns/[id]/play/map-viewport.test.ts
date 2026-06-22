import { describe, expect, it } from "vitest";

import { clampZoom } from "./map-viewport";

describe("clampZoom", () => {
  it("clamps below the minimum and above the maximum", () => {
    expect(clampZoom(0.1)).toBe(0.6);
    expect(clampZoom(5)).toBe(1.6);
  });

  it("passes through in-range values", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(1.2)).toBe(1.2);
  });

  it("rounds away floating-point step drift", () => {
    expect(clampZoom(0.6 + 0.2 + 0.2)).toBe(1);
  });
});
