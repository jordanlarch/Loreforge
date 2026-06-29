import { describe, expect, it } from "vitest";

import {
  BURNING_SLUG,
  fallDamageDiceCount,
  fallDamageNotation,
  isBurningSlug,
} from "./srd-exploration-hazard-seeds";

describe("srd-exploration-hazard-seeds", () => {
  it("fall damage uses 1d6 per 10 ft capped at 20d6", () => {
    expect(fallDamageDiceCount(0)).toBe(0);
    expect(fallDamageDiceCount(5)).toBe(0);
    expect(fallDamageDiceCount(10)).toBe(1);
    expect(fallDamageDiceCount(30)).toBe(3);
    expect(fallDamageDiceCount(200)).toBe(20);
    expect(fallDamageNotation(30)).toBe("3d6");
    expect(fallDamageNotation(5)).toBeNull();
  });

  it("recognizes the burning glossary slug", () => {
    expect(isBurningSlug(BURNING_SLUG)).toBe(true);
    expect(isBurningSlug("srd-2024_falling")).toBe(false);
  });
});
