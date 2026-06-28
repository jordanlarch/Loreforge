import { describe, expect, it } from "vitest";

import { validateFearStressDefinition } from "@app/engine";

import { SRD_TOOLBOX_FEAR_STRESS_SEEDS } from "./srd-toolbox-fear-stress";

describe("srd-toolbox-fear-stress seeds", () => {
  it("validates every hand-seeded fear/stress entry", () => {
    for (const seed of SRD_TOOLBOX_FEAR_STRESS_SEEDS) {
      const errors = validateFearStressDefinition(seed.definition);
      expect(errors, seed.slug).toEqual([]);
    }
  });

  it("uses srd-2024 slug scheme", () => {
    for (const seed of SRD_TOOLBOX_FEAR_STRESS_SEEDS) {
      expect(seed.slug.startsWith("srd-2024_")).toBe(true);
    }
  });
});
