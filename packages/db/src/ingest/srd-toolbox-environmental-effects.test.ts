import { describe, expect, it } from "vitest";

import { validateEnvironmentalEffectDefinition } from "@app/engine";

import { SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS } from "./srd-toolbox-environmental-effects";

describe("srd-toolbox-environmental-effects seeds", () => {
  it("validates every hand-seeded environmental effect", () => {
    for (const seed of SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS) {
      const errors = validateEnvironmentalEffectDefinition(seed.definition);
      expect(errors, seed.slug).toEqual([]);
    }
  });

  it("uses srd-2024 slug scheme", () => {
    for (const seed of SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS) {
      expect(seed.slug.startsWith("srd-2024_")).toBe(true);
    }
  });
});
