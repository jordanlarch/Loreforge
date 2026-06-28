import { describe, expect, it } from "vitest";

import {
  codexItemToEquipment,
  codexSpellToCharacterSpell,
  equipmentKey,
  mergeEquippedCodexItem,
  mergeEquippedSmithyItem,
  mergePreparedCodexSpell,
  mergePreparedSmithySpell,
  smithyItemToEquipment,
  smithySpellToCharacterSpell,
  spellKey,
} from "./character-library";
import type { CharacterSpell, EquipmentItem, SpellLoadout } from "@/lib/character";

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

  it("maps Codex items to equipment", () => {
    expect(
      codexItemToEquipment(
        {
          name: "Longsword",
          slug: "longsword",
          category: "weapon",
          weight: "3",
          description: "A versatile blade.",
          requiresAttunement: false,
        },
        { equipped: true },
      ),
    ).toEqual({
      name: "Longsword",
      quantity: 1,
      equipped: true,
      slot: "weapon",
      weight: 3,
      attunement: false,
      description: "A versatile blade.",
      codexSlug: "longsword",
    });
  });

  it("mergePreparedCodexSpell adds or marks prepared", () => {
    const empty: SpellLoadout = { spells: [], slots: {} };
    const spell = {
      name: "Shield",
      level: "1",
      school: "abjuration",
      slug: "shield",
    };
    const added = mergePreparedCodexSpell(empty, spell);
    expect(added.spells).toHaveLength(1);
    expect(added.spells[0]?.prepared).toBe(true);
    expect(added.spells[0]?.codexSlug).toBe("shield");

    const existing: SpellLoadout = {
      spells: [{ name: "Shield", level: 1, prepared: false }],
      slots: {},
    };
    const updated = mergePreparedCodexSpell(existing, spell);
    expect(updated.spells).toHaveLength(1);
    expect(updated.spells[0]?.prepared).toBe(true);
  });

  it("mergeEquippedCodexItem adds or marks equipped", () => {
    const item = {
      name: "Chain Mail",
      category: "armor",
      weight: "55",
    };
    const added = mergeEquippedCodexItem([], item);
    expect(added).toHaveLength(1);
    expect(added[0]?.equipped).toBe(true);

    const existing: EquipmentItem[] = [
      { name: "Chain Mail", quantity: 1, equipped: false, weight: 55 },
    ];
    const updated = mergeEquippedCodexItem(existing, item);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.equipped).toBe(true);
  });

  it("mergePreparedSmithySpell adds or marks prepared", () => {
    const empty: SpellLoadout = { spells: [], slots: {} };
    const spell = { name: "Jordan's Bolt", level: 0, school: "evocation" };
    const added = mergePreparedSmithySpell(empty, spell);
    expect(added.spells).toHaveLength(1);
    expect(added.spells[0]?.prepared).toBe(true);

    const existing: SpellLoadout = {
      spells: [{ name: "Jordan's Bolt", level: 0, prepared: false }],
      slots: {},
    };
    const updated = mergePreparedSmithySpell(existing, spell);
    expect(updated.spells).toHaveLength(1);
    expect(updated.spells[0]?.prepared).toBe(true);
  });

  it("mergeEquippedSmithyItem adds or marks equipped", () => {
    const item = {
      id: "item-1",
      name: "Flame Tongue",
      type: "Weapon",
      rarity: "Rare",
      description: "A fiery blade.",
      requiresAttunement: true,
    };
    const added = mergeEquippedSmithyItem([], item);
    expect(added).toHaveLength(1);
    expect(added[0]?.equipped).toBe(true);
    expect(added[0]?.smithyItemId).toBe("item-1");

    const existing: EquipmentItem[] = [
      {
        name: "Flame Tongue",
        quantity: 1,
        equipped: false,
        smithyItemId: "item-1",
      },
    ];
    const updated = mergeEquippedSmithyItem(existing, item);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.equipped).toBe(true);
  });
});
