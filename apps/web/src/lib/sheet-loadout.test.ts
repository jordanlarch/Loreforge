import { describe, expect, it } from "vitest";

import type { EntityState } from "@app/engine";

import type { EquipmentItem, SpellLoadout } from "./character";
import {
  deriveWeaponAttacks,
  matchWeapon,
  preparedSpellNames,
  quickUseItems,
  sheetCastableSpells,
} from "./sheet-loadout";

function entity(over: Partial<EntityState> & { id: string }): EntityState {
  return {
    kind: "character",
    name: over.id,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: { current: 10, max: 10, temp: 0 },
    baseAc: 10,
    speed: 30,
    classes: [],
    proficiencyBonus: 2,
    alive: true,
    conditions: [],
    dead: false,
    sceneId: "s1",
    position: { x: 0, y: 0 },
    ...over,
  };
}

function item(over: Partial<EquipmentItem> & { name: string }): EquipmentItem {
  return { quantity: 1, equipped: true, ...over };
}

describe("matchWeapon", () => {
  it("matches exact and decorated weapon names", () => {
    expect(matchWeapon("Longsword")?.dice).toBe("1d8");
    expect(matchWeapon("Flametongue Longsword")?.dice).toBe("1d8");
    expect(matchWeapon("+1 Rapier")?.finesse).toBe(true);
    expect(matchWeapon("Shortbow")?.ranged).toBe(true);
  });

  it("returns undefined for non-weapons", () => {
    expect(matchWeapon("Bag of Holding")).toBeUndefined();
    expect(matchWeapon("")).toBeUndefined();
  });
});

describe("deriveWeaponAttacks", () => {
  it("uses STR + proficiency for a melee weapon", () => {
    const hero = entity({
      id: "hero",
      abilityScores: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 3,
    });
    const [atk] = deriveWeaponAttacks(hero, [item({ name: "Longsword" })]);
    expect(atk?.attackBonus).toBe(6); // +3 STR +3 prof
    expect(atk?.damage.notation).toBe("1d8+3");
    expect(atk?.rangeFt).toBe(5);
  });

  it("uses DEX and the listed range for a ranged weapon", () => {
    const archer = entity({
      id: "archer",
      abilityScores: { str: 8, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2,
    });
    const [atk] = deriveWeaponAttacks(archer, [item({ name: "Shortbow" })]);
    expect(atk?.attackBonus).toBe(5); // +3 DEX +2 prof
    expect(atk?.damage.notation).toBe("1d6+3");
    expect(atk?.rangeFt).toBe(80);
  });

  it("ignores unequipped, zero-quantity, and non-weapon items", () => {
    const hero = entity({ id: "hero" });
    const attacks = deriveWeaponAttacks(hero, [
      item({ name: "Longsword", equipped: false }),
      item({ name: "Greataxe", quantity: 0 }),
      item({ name: "Bedroll" }),
    ]);
    // None usable → generic Strike fallback.
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.id).toBe("strike");
  });

  it("de-duplicates repeated weapons", () => {
    const hero = entity({ id: "hero" });
    const attacks = deriveWeaponAttacks(hero, [
      item({ name: "Dagger" }),
      item({ name: "Dagger" }),
    ]);
    expect(attacks).toHaveLength(1);
  });
});

describe("preparedSpellNames", () => {
  it("includes cantrips, prepared, and always-prepared; excludes unprepared", () => {
    const loadout: SpellLoadout = {
      spells: [
        { name: "Fire Bolt", level: 0, prepared: false },
        { name: "Guiding Bolt", level: 1, prepared: true },
        { name: "Bless", level: 1, prepared: false },
        { name: "Sacred Flame", level: 0, prepared: false },
        { name: "Shield of Faith", level: 1, prepared: false, alwaysPrepared: true },
      ],
      slots: {},
    };
    const names = preparedSpellNames(loadout);
    expect(names).toContain("Fire Bolt");
    expect(names).toContain("Guiding Bolt");
    expect(names).toContain("Sacred Flame");
    expect(names).toContain("Shield of Faith");
    expect(names).not.toContain("Bless");
  });
});

describe("sheetCastableSpells", () => {
  it("returns nothing for a non-caster even with spells listed", () => {
    expect(sheetCastableSpells(entity({ id: "x" }), ["Fire Bolt"])).toEqual([]);
  });

  it("offers known cantrips always and leveled spells only with a free slot", () => {
    const caster = entity({
      id: "c",
      spellcasting: { ability: "wis", slots: { 1: { max: 2, current: 1 } } },
    });
    const ids = sheetCastableSpells(caster, [
      "Sacred Flame",
      "Guiding Bolt",
    ]).map((s) => s.id);
    expect(ids).toContain("sacred-flame");
    expect(ids).toContain("guiding-bolt");

    const noSlot = entity({
      id: "c2",
      spellcasting: { ability: "wis", slots: { 1: { max: 2, current: 0 } } },
    });
    const ids2 = sheetCastableSpells(noSlot, ["Sacred Flame", "Guiding Bolt"]).map(
      (s) => s.id,
    );
    expect(ids2).toEqual(["sacred-flame"]);
  });

  it("excludes spells the character doesn't have", () => {
    const caster = entity({
      id: "c",
      spellcasting: { ability: "int", slots: {} },
    });
    expect(sheetCastableSpells(caster, ["Eldritch Blast"])).toEqual([]);
  });
});

describe("quickUseItems", () => {
  it("surfaces consumables and ignores gear", () => {
    const items = quickUseItems([
      item({ name: "Potion of Healing", quantity: 3 }),
      item({ name: "Scroll of Fireball" }),
      item({ name: "Longsword" }),
      item({ name: "Antitoxin", quantity: 0 }),
    ]);
    expect(items.map((i) => i.name)).toEqual([
      "Potion of Healing",
      "Scroll of Fireball",
    ]);
    expect(items[0]?.quantity).toBe(3);
  });
});
