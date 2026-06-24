import { describe, expect, it } from "vitest";

import { validateSpellDefinition } from "./spells";
import { open5eRawToSpellDefinition } from "./open5e-spell";

const FIREBALL_RAW = {
  key: "srd_fireball",
  name: "Fireball",
  level: 3,
  school: { name: "Evocation", key: "evocation" },
  classes: [{ name: "Sorcerer" }, { name: "Wizard" }],
  range: 150,
  range_text: "150 feet",
  range_unit: "feet",
  shape_type: "sphere",
  shape_size: 20,
  casting_time: "action",
  verbal: true,
  somatic: true,
  material: true,
  material_specified: "A tiny ball of bat guano and sulfur.",
  duration: "instantaneous",
  concentration: false,
  ritual: false,
  saving_throw_ability: "dexterity",
  attack_roll: false,
  damage_roll: "8d6",
  damage_types: ["fire"],
  desc: "A bright streak flashes from your pointing finger…",
  higher_level:
    "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
  casting_options: [
    { type: "default", damage_roll: null },
    { type: "slot_level_4", damage_roll: "9d6" },
  ],
};

describe("open5eRawToSpellDefinition", () => {
  it("maps Fireball into a valid SpellDefinition", () => {
    const def = open5eRawToSpellDefinition(FIREBALL_RAW, {
      slug: "srd_fireball",
    });
    expect(def.name).toBe("Fireball");
    expect(def.level).toBe(3);
    expect(def.school).toBe("evocation");
    expect(def.classes).toEqual(["sorcerer", "wizard"]);
    expect(def.range).toEqual({
      type: "feet",
      amount: 150,
      area: { shape: "sphere", size: 20 },
    });
    expect(def.targeting).toBe("area");
    expect(def.saveAgainst?.ability).toBe("dex");
    expect(def.damage).toEqual([{ dice: "8d6", type: "fire" }]);
    expect(def.upcastScaling).toEqual({
      perSlotDice: "1d6",
      appliesTo: "damage",
    });
    expect(validateSpellDefinition(def)).toEqual([]);
  });
});
