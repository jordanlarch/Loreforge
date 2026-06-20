import { describe, expect, it } from "vitest";

import {
  REALM_ENTITY_TYPES,
  REALM_FIELDS,
  REALM_RELATIONSHIP_KINDS,
  REALM_TYPE_LABEL,
  REALM_TYPE_LABEL_PLURAL,
  REL_INVERSE_LABEL,
  REL_LABEL,
  emptyDataFor,
  emptyNpcData,
  npcToSheetInput,
  type RealmEntityType,
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

describe("descriptive field descriptors", () => {
  const descriptiveTypes = REALM_ENTITY_TYPES.filter(
    (t) => t !== "npc",
  ) as Exclude<RealmEntityType, "npc">[];

  it("defines fields with unique keys for every non-NPC type", () => {
    for (const type of descriptiveTypes) {
      const fields = REALM_FIELDS[type];
      expect(fields.length).toBeGreaterThan(0);
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives select fields at least one option", () => {
    for (const type of descriptiveTypes) {
      for (const field of REALM_FIELDS[type]) {
        if (field.kind === "select") {
          expect(field.options && field.options.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("emptyDataFor", () => {
  it("seeds a value of the right shape for every descriptive field", () => {
    const descriptiveTypes = REALM_ENTITY_TYPES.filter((t) => t !== "npc");
    for (const type of descriptiveTypes) {
      const data = emptyDataFor(type);
      for (const field of REALM_FIELDS[type as Exclude<RealmEntityType, "npc">]) {
        const value = data[field.key];
        if (field.kind === "number") {
          expect(typeof value).toBe("number");
        } else if (field.kind === "select") {
          expect(value).toBe(field.options?.[0]);
        } else {
          expect(value).toBe("");
        }
      }
    }
  });

  it("returns a full NPC payload for the npc type", () => {
    expect(emptyDataFor("npc")).toEqual(emptyNpcData());
  });
});

describe("relationship taxonomy", () => {
  it("has a forward and inverse label for every kind", () => {
    for (const kind of REALM_RELATIONSHIP_KINDS) {
      expect(REL_LABEL[kind]).toBeTruthy();
      expect(REL_INVERSE_LABEL[kind]).toBeTruthy();
    }
  });
});
