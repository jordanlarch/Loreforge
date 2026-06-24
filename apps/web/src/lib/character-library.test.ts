import { describe, expect, it } from "vitest";

import {
  codexSpellToCharacterSpell,
  equipmentKey,
  smithyItemToEquipment,
  smithySpellToCharacterSpell,
  spellKey,
} from "./character-library";

describe("character-library mappers", () => {
  it("maps a Smithy item to equipment with smithyItemId", () => {
    expect(
      smithyItemToEquipment({
        id: "abc-123",
        name: "Flame Tongue",
        type: "Weapon",
        rarity: "Rare",
        description: "A fiery blade.",
        requiresAttunement: true,
      }),
    ).toEqual({
      name: "Flame Tongue",
      quantity: 1,
      equipped: false,
      smithyItemId: "abc-123",
      slot: "Weapon",
      rarity: "Rare",
      attunement: true,
      description: "A fiery blade.",
    });
  });

  it("maps Codex and Smithy spells", () => {
    expect(
      codexSpellToCharacterSpell({
        name: "Fireball",
        level: "3",
        school: "evocation",
      }),
    ).toEqual({
      name: "Fireball",
      level: 3,
      prepared: false,
      source: "Codex · evocation",
    });

    expect(
      smithySpellToCharacterSpell({
        name: "Jordan's Bolt",
        level: 0,
        school: "evocation",
      }),
    ).toEqual({
      name: "Jordan's Bolt",
      level: 0,
      prepared: false,
      source: "Smithy · evocation",
    });
  });

  it("dedupes by spellKey and equipmentKey", () => {
    expect(spellKey({ name: "Fireball", level: 3 })).toBe("3:fireball");
    expect(
      equipmentKey({ name: "Torch", smithyItemId: "id-1" }),
    ).toBe("smithy:id-1");
    expect(equipmentKey({ name: "Torch" })).toBe("name:torch");
  });
});
