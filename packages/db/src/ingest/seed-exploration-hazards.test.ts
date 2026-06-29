import { describe, expect, it } from "vitest";

import {
  EXPLORATION_HAZARD_GLOSSARY_SEEDS,
  EXPLORATION_HAZARD_GLOSSARY_SLUGS,
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
} from "./srd-exploration-hazards";

describe("srd-exploration-hazards seeds", () => {
  it("defines overview and five glossary slugs", () => {
    expect(EXPLORATION_HAZARDS_OVERVIEW_SLUG).toBe(
      "srd-2024_exploration-hazards",
    );
    expect(EXPLORATION_HAZARD_GLOSSARY_SLUGS).toHaveLength(5);
    expect(EXPLORATION_HAZARD_GLOSSARY_SEEDS.map((s) => s.slug)).toEqual([
      ...EXPLORATION_HAZARD_GLOSSARY_SLUGS,
    ]);
  });

  it("includes non-empty prose for every seed", () => {
    for (const seed of EXPLORATION_HAZARD_GLOSSARY_SEEDS) {
      expect(seed.description.trim().length).toBeGreaterThan(40);
      expect(seed.name.length).toBeGreaterThan(0);
    }
  });
});
