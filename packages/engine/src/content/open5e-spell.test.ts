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
  desc: "A bright streak flashes from your pointing finger… Each creature in a 20-foot-radius Sphere makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.",
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
    // AoE damage spell that says "half as much damage" ⇒ save-for-half.
    expect(def.saveAgainst?.onSuccess).toBe("half_damage");
    expect(def.damage).toEqual([{ dice: "8d6", type: "fire" }]);
    expect(def.upcastScaling).toEqual({
      perSlotDice: "1d6",
      appliesTo: "damage",
    });
    expect(validateSpellDefinition(def)).toEqual([]);
  });

  // SRD-FID-6: the converter used to default every save spell to half-on-success,
  // which is wrong for the many single-target save spells that do nothing on a
  // success. Infer "no effect" unless the text explicitly grants half.
  it("infers no-effect for a damaging save spell without 'half' (Sacred Flame)", () => {
    const def = open5eRawToSpellDefinition(
      {
        name: "Sacred Flame",
        level: 0,
        school: { key: "evocation" },
        classes: [{ name: "Cleric" }],
        range: 60,
        range_text: "60 feet",
        range_unit: "feet",
        casting_time: "action",
        verbal: true,
        somatic: true,
        duration: "instantaneous",
        saving_throw_ability: "dexterity",
        damage_roll: "1d8",
        damage_types: ["radiant"],
        desc: "The target must succeed on a Dexterity saving throw or take 1d8 Radiant damage. The target gains no benefit from cover for this save.",
      },
      { slug: "srd-2024_sacred-flame" },
    );
    expect(def.saveAgainst?.onSuccess).toBe("no_effect");
  });

  it("infers no-effect for a non-damaging save spell (Hold Person)", () => {
    const def = open5eRawToSpellDefinition(
      {
        name: "Hold Person",
        level: 2,
        school: { key: "enchantment" },
        classes: [{ name: "Cleric" }, { name: "Wizard" }],
        range: 60,
        range_text: "60 feet",
        range_unit: "feet",
        casting_time: "action",
        verbal: true,
        somatic: true,
        material: true,
        duration: "1 minute",
        concentration: true,
        saving_throw_ability: "wisdom",
        desc: "The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration.",
      },
      { slug: "srd-2024_hold-person" },
    );
    expect(def.saveAgainst?.onSuccess).toBe("no_effect");
  });
});
