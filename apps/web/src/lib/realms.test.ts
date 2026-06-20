import { describe, expect, it } from "vitest";

import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_LABEL,
  REALM_TYPE_LABEL_PLURAL,
  emptyNpcData,
  npcToSheetInput,
} from "./realms";

describe("realms taxonomy", () => {
  it("has a singular and plural label for every type", () => {
    for (const type of REALM_ENTITY_TYPES) {
      expect(REALM_TYPE_LABEL[type]).toBeTruthy();
      expect(REALM_TYPE_LABEL_PLURAL[type]).toBeTruthy();
    }
  });

  it("lists exactly the eight worldbuilding types", () => {
    expect(REALM_ENTITY_TYPES).toHaveLength(8);
    expect(REALM_ENTITY_TYPES).toContain("npc");
    expect(REALM_ENTITY_TYPES).toContain("region");
  });
});

describe("npcToSheetInput", () => {
  it("maps stored NPC data into the engine sheet input", () => {
    const data = {
      ...emptyNpcData(),
      species: "Dwarf",
      role: "Blacksmith",
      classes: [{ class: "Fighter", level: 3 }],
      abilityScores: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      maxHp: 28,
      baseAc: 16,
      speed: 25,
      saveProficiencies: ["str", "con"] as const,
      skillProficiencies: ["Athletics"],
    };
    const sheet = npcToSheetInput({ id: "e1", name: "Thrain", data });
    expect(sheet).toEqual({
      id: "e1",
      name: "Thrain",
      species: "Dwarf",
      background: "Blacksmith",
      classes: [{ class: "Fighter", level: 3 }],
      abilityScores: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      maxHp: 28,
      baseAc: 16,
      speed: 25,
      saveProficiencies: ["str", "con"],
      skillProficiencies: ["Athletics"],
    });
  });

  it("falls back to defaults for an empty/legacy data payload", () => {
    const sheet = npcToSheetInput({ id: "e2", name: "Nameless", data: {} });
    expect(sheet.classes).toEqual([]);
    expect(sheet.abilityScores).toEqual({
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    });
    expect(sheet.baseAc).toBe(10);
    expect(sheet.speed).toBe(30);
  });
});
