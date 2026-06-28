import { describe, expect, it } from "vitest";

import { validatePoisonDefinition } from "@app/engine";

import { SRD_TOOLBOX_POISON_SEEDS } from "./srd-toolbox-poisons";

describe("srd-toolbox-poisons seeds", () => {
  it("validates every hand-seeded poison", () => {
    for (const seed of SRD_TOOLBOX_POISON_SEEDS) {
      const errors = validatePoisonDefinition(seed.definition);
      expect(errors, seed.slug).toEqual([]);
    }
  });

  it("uses srd-2024 slug scheme", () => {
    for (const seed of SRD_TOOLBOX_POISON_SEEDS) {
      expect(seed.slug.startsWith("srd-2024_")).toBe(true);
    }
  });
});
