import { describe, expect, it } from "vitest";

import {
  DAMAGE_TYPES,
  isValidSpellDefinition,
  SPELL_LEVELS,
  SPELL_SCHOOLS,
  validateSpellDefinition,
  type SpellDefinition,
} from "./spells";

/** A minimal valid declarative spell (Fireball-ish) to mutate per test. */
function fireball(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: "fireball",
    name: "Fireball",
    level: 3,
    school: "evocation",
    classes: ["sorcerer", "wizard"],
    castingTime: { unit: "action", amount: 1 },
    range: { type: "feet", amount: 150, area: { shape: "sphere", size: 20 } },
    components: { verbal: true, somatic: true, material: "a tiny ball of bat guano" },
    duration: { unit: "instantaneous" },
    concentration: false,
    ritual: false,
    targeting: "area",
    saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
    damage: [{ dice: "8d6", type: "fire" }],
    upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
    description: "A bright streak flashes to a point and blossoms with a low roar.",
    ...overrides,
  };
}

describe("spell taxonomy", () => {
  it("covers cantrips through level 9", () => {
    expect(SPELL_LEVELS[0]).toBe(0);
    expect(SPELL_LEVELS.at(-1)).toBe(9);
    expect(SPELL_LEVELS).toHaveLength(10);
  });

  it("has the eight schools of magic", () => {
    expect(SPELL_SCHOOLS).toHaveLength(8);
    expect(SPELL_SCHOOLS).toContain("evocation");
  });

  it("lists the SRD damage types", () => {
    expect(DAMAGE_TYPES).toContain("fire");
    expect(DAMAGE_TYPES).toContain("psychic");
    expect(new Set(DAMAGE_TYPES).size).toBe(DAMAGE_TYPES.length);
  });
});

describe("validateSpellDefinition", () => {
  it("accepts a well-formed declarative spell", () => {
    expect(validateSpellDefinition(fireball())).toEqual([]);
    expect(isValidSpellDefinition(fireball())).toBe(true);
  });

  it("requires a distance for ranged spells", () => {
    const errors = validateSpellDefinition(
      fireball({ range: { type: "feet" } }),
    );
    expect(errors.some((e) => e.includes("distance"))).toBe(true);
  });

  it("rejects spells that use both a save and an attack roll", () => {
    const errors = validateSpellDefinition(
      fireball({ attackAgainst: { type: "ranged" } }),
    );
    expect(
      errors.some((e) => e.includes("both a saving throw and an attack")),
    ).toBe(true);
  });

  it("rejects invalid damage dice", () => {
    const errors = validateSpellDefinition(
      fireball({ damage: [{ dice: "8xY", type: "fire" }] }),
    );
    expect(errors.some((e) => e.includes("invalid dice"))).toBe(true);
  });

  it("rejects an unknown damage type", () => {
    const errors = validateSpellDefinition(
      // @ts-expect-error — deliberately invalid damage type
      fireball({ damage: [{ dice: "8d6", type: "spicy" }] }),
    );
    expect(errors.some((e) => e.includes("unknown damage type"))).toBe(true);
  });

  it("forbids slot-based upcast on a cantrip", () => {
    const errors = validateSpellDefinition(
      fireball({
        level: 0,
        upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
      }),
    );
    expect(errors.some((e) => e.includes("Cantrips cannot"))).toBe(true);
  });

  it("requires an amount for timed durations", () => {
    const errors = validateSpellDefinition(
      fireball({ duration: { unit: "minute" } }),
    );
    expect(errors.some((e) => e.includes("needs an amount"))).toBe(true);
  });

  it("validates healing dice when present", () => {
    const cure: SpellDefinition = fireball({
      id: "cure-wounds",
      name: "Cure Wounds",
      level: 1,
      school: "evocation",
      range: { type: "touch" },
      targeting: "single",
      saveAgainst: undefined,
      damage: undefined,
      healing: { dice: "nonsense" },
      upcastScaling: { perSlotDice: "1d8", appliesTo: "healing" },
    });
    expect(
      validateSpellDefinition(cure).some((e) => e.includes("Healing has invalid")),
    ).toBe(true);
  });
});
