import type { SpellDefinition } from "@app/engine";
import { describe, expect, it } from "vitest";

import {
  emptySpellFormState,
  spellDefinitionToFormState,
  spellFormStateToPayload,
} from "./smithy-spell-form-state";

const sampleDef: SpellDefinition = {
  id: "test-fireball",
  name: "Fireball",
  level: 3,
  school: "evocation",
  classes: ["Wizard", "Sorcerer"],
  castingTime: { unit: "action", amount: 1 },
  range: {
    type: "feet",
    amount: 150,
    area: { shape: "sphere", size: 20 },
  },
  components: { verbal: true, somatic: true, material: "bat guano" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "fire" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description: "A bright streak flashes…",
};

describe("smithy-spell-form-state", () => {
  it("round-trips definition through form state", () => {
    const form = spellDefinitionToFormState(sampleDef);
    const payload = spellFormStateToPayload(form);

    expect(payload.name).toBe(sampleDef.name);
    expect(payload.level).toBe(sampleDef.level);
    expect(payload.school).toBe(sampleDef.school);
    expect(payload.classes).toEqual(sampleDef.classes);
    expect(payload.castingTime).toEqual(sampleDef.castingTime);
    expect(payload.range).toEqual(sampleDef.range);
    expect(payload.components).toEqual(sampleDef.components);
    expect(payload.duration).toEqual(sampleDef.duration);
    expect(payload.saveAgainst).toEqual(sampleDef.saveAgainst);
    expect(payload.damage).toEqual(sampleDef.damage);
    expect(payload.upcastScaling).toEqual(sampleDef.upcastScaling);
    expect(payload.description).toBe(sampleDef.description);
  });

  it("defaults empty form to sensible create payload", () => {
    const payload = spellFormStateToPayload(emptySpellFormState());
    expect(payload.name).toBe("");
    expect(payload.level).toBe(1);
    expect(payload.classes).toEqual([]);
    expect(payload.damage).toBeUndefined();
    expect(payload.saveAgainst).toBeUndefined();
  });
});
