import { describe, expect, it } from "vitest";

import {
  isValidTrapDefinition,
  toolboxEntryId,
  validateTrapDefinition,
  type TrapDefinition,
} from "./toolbox-definitions";

describe("toolbox-definitions traps", () => {
  it("validates a PDF-faithful poison needle trap", () => {
    const def: TrapDefinition = {
      id: toolboxEntryId("Poison Needle"),
      name: "Poison Needle",
      kind: "trap",
      description: "A hidden needle in a lock.",
      trigger: "A creature touches the trap with an object or hand.",
      effect: {
        save: { ability: "con", dc: 15, onSuccess: "negates" },
        damage: [{ dice: "1d8", type: "poison" }],
        conditions: ["poisoned"],
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    };
    expect(isValidTrapDefinition(def)).toBe(true);
  });

  it("requires trigger and effect", () => {
    const def: TrapDefinition = {
      id: "bad",
      name: "Bad",
      kind: "trap",
      description: "x",
      trigger: "",
      effect: {},
      reset: "once",
    };
    expect(validateTrapDefinition(def)).toContain("Trigger is required.");
    expect(validateTrapDefinition(def)).toContain(
      "Effect requires save/damage/conditions or effect prose.",
    );
  });

  it("accepts effect prose escape hatch", () => {
    const def: TrapDefinition = {
      id: toolboxEntryId("Sleep of Ages"),
      name: "Sleep of Ages",
      kind: "trap",
      description: "Magical sleep trap.",
      trigger: "A creature opens the sarcophagus.",
      effect: { effectProse: "Target falls unconscious until freed by Remove Curse." },
      reset: "once",
    };
    expect(isValidTrapDefinition(def)).toBe(true);
  });
});
