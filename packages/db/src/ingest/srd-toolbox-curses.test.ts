import { describe, expect, it } from "vitest";

import { validateCurseDefinition } from "@app/engine";

import { SRD_TOOLBOX_CURSE_SEEDS } from "./srd-toolbox-curses";

describe("srd-toolbox-curses seeds", () => {
  it("validates every hand-seeded curse/contagion", () => {
    for (const seed of SRD_TOOLBOX_CURSE_SEEDS) {
      const errors = validateCurseDefinition(seed.definition);
      expect(errors, seed.slug).toEqual([]);
    }
  });

  it("uses srd-2024 slug scheme", () => {
    for (const seed of SRD_TOOLBOX_CURSE_SEEDS) {
      expect(seed.slug.startsWith("srd-2024_")).toBe(true);
    }
  });
});
