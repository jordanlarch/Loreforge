import { describe, expect, it } from "vitest";

import {
  isValidCurseDefinition,
  isValidPoisonDefinition,
  isValidTrapDefinition,
  toolboxEntryId,
  validateCurseDefinition,
  validatePoisonDefinition,
  validateTrapDefinition,
  type CurseDefinition,
  type PoisonDefinition,
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

describe("toolbox-definitions poisons", () => {
  it("validates assassin's blood style poison", () => {
    const def: PoisonDefinition = {
      id: toolboxEntryId("Assassin's Blood"),
      name: "Assassin's Blood",
      kind: "poison",
      description: "Ingested poison.",
      poisonType: "ingested",
      save: { ability: "con", dc: 10, onSuccess: "half" },
      damage: [{ dice: "1d12", type: "poison" }],
      conditions: ["poisoned"],
      repeat: "Poisoned for 24 hours on a failed save.",
    };
    expect(isValidPoisonDefinition(def)).toBe(true);
  });

  it("requires at least one mechanical field", () => {
    const def: PoisonDefinition = {
      id: "bad",
      name: "Bad",
      kind: "poison",
      description: "x",
      poisonType: "injury",
    };
    expect(validatePoisonDefinition(def)).toContain(
      "Poison requires save, damage, conditions, or repeat rules.",
    );
  });
});

describe("toolbox-definitions curses", () => {
  it("validates demonic possession style curse", () => {
    const def: CurseDefinition = {
      id: toolboxEntryId("Demonic Possession"),
      name: "Demonic Possession",
      kind: "curse",
      description: "Environmental curse.",
      save: { ability: "cha", dc: 15, onSuccess: "negates" },
      effects: ["Possessed on a failed initial save."],
      recovery: "Remove Curse or successful save after Long Rest.",
    };
    expect(isValidCurseDefinition(def)).toBe(true);
  });

  it("requires at least one mechanical field", () => {
    const def: CurseDefinition = {
      id: "bad",
      name: "Bad",
      kind: "curse",
      description: "x",
    };
    expect(validateCurseDefinition(def)).toContain(
      "Curse requires save, effects, contagion, or recovery rules.",
    );
  });
});
