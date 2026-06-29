import { describe, expect, it } from "vitest";

import { BURNING_SLUG } from "@app/engine";

import {
  activeBurningHudLabel,
  explorationHazardLabel,
  explorationHazardsForUse,
  formatSceneExplorationHazards,
} from "./live-exploration-hazards";

describe("live-exploration-hazards", () => {
  it("formats scene hazard labels", () => {
    expect(formatSceneExplorationHazards([BURNING_SLUG])).toBe("burning");
    expect(explorationHazardLabel(BURNING_SLUG)).toBe("burning");
  });

  it("resolves demo items for Use Item", () => {
    const items = explorationHazardsForUse([
      { name: "Alchemist's Fire (flask)", quantity: 1, equipped: false },
      { name: "Pitfall Sample (30 ft)", quantity: 1, equipped: false },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.burningSlug).toBe(BURNING_SLUG);
    expect(items[1]?.fallHeightFt).toBe(30);
  });

  it("labels active burning on the HUD", () => {
    expect(
      activeBurningHudLabel({
        instanceId: "burn:pc:1",
        burningSlug: BURNING_SLUG,
        pendingRepeat: true,
      }),
    ).toBe("Burning — burning");
  });
});
