import { describe, expect, it } from "vitest";

import {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  isExplorationHazardGlossarySlug,
  isExplorationHazardsContextSlug,
} from "./codex-exploration-hazards";

describe("codex-exploration-hazards", () => {
  it("detects exploration hazards context slugs", () => {
    expect(isExplorationHazardsContextSlug(EXPLORATION_HAZARDS_OVERVIEW_SLUG)).toBe(
      true,
    );
    expect(isExplorationHazardsContextSlug("srd-2024_falling")).toBe(true);
    expect(isExplorationHazardsContextSlug("srd-2024_traps-rules")).toBe(false);
    expect(isExplorationHazardsContextSlug(null)).toBe(false);
  });

  it("identifies glossary slugs", () => {
    expect(isExplorationHazardGlossarySlug("srd-2024_burning")).toBe(true);
    expect(isExplorationHazardGlossarySlug("srd-2024_exploration-hazards")).toBe(
      false,
    );
  });
});
