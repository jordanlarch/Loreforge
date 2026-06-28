import { describe, expect, it } from "vitest";

import {
  hazardDefinitionId,
  isValidHazardDefinition,
  validateHazardDefinition,
  type HazardDefinition,
} from "./hazard-definitions";

describe("hazard-definitions", () => {
  it("validates a trap with save and damage", () => {
    const def: HazardDefinition = {
      id: hazardDefinitionId("Poison Needle"),
      name: "Poison Needle",
      kind: "trap",
      description: "A hidden needle in a lock.",
      save: { ability: "con", dc: 12, onSuccess: "negates" },
      damage: [{ dice: "1d4", type: "poison" }],
      conditions: ["poisoned"],
    };
    expect(isValidHazardDefinition(def)).toBe(true);
  });

  it("rejects invalid save DC", () => {
    const def: HazardDefinition = {
      id: "bad",
      name: "Bad",
      kind: "poison",
      description: "x",
      save: { ability: "con", dc: 0, onSuccess: "none" },
    };
    expect(validateHazardDefinition(def)).toContain(
      "Save DC must be between 1 and 30.",
    );
  });
});
