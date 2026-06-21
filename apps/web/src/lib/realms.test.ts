import { describe, expect, it } from "vitest";

import {
  REALM_ENTITY_TYPES,
  REALM_FIELDS,
  REALM_RELATIONSHIP_KINDS,
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  REALM_TYPE_LABEL_PLURAL,
  REL_INVERSE_LABEL,
  REL_LABEL,
  emptyDataFor,
  emptyGroupItem,
  emptyNpcData,
  layoutGraph,
  npcToSheetInput,
  realmSections,
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
        } else if (field.kind === "list" || field.kind === "group") {
          expect(value).toEqual([]);
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

describe("rich Settlement schema", () => {
  it("groups settlement fields into ordered sections (tabs)", () => {
    const sections = realmSections("settlement");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Notable Places");
    // Every field is accounted for exactly once across the sections.
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.settlement.length);
  });

  it("preserves the original thin keys so legacy settlements stay valid", () => {
    const keys = REALM_FIELDS.settlement.map((f) => f.key);
    for (const legacy of ["size", "population", "government", "notes"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("declares list and group fields with item metadata", () => {
    const byKey = new Map(REALM_FIELDS.settlement.map((f) => [f.key, f]));
    expect(byKey.get("rumors")?.kind).toBe("list");
    const group = byKey.get("notableLocations");
    expect(group?.kind).toBe("group");
    expect((group?.fields ?? []).length).toBeGreaterThan(0);
  });

  it("seeds an empty group item from its sub-fields", () => {
    const group = REALM_FIELDS.settlement.find((f) => f.kind === "group")!;
    const item = emptyGroupItem(group);
    for (const sub of group.fields ?? []) {
      if (sub.kind === "number") expect(typeof item[sub.key]).toBe("number");
      else expect(item[sub.key]).toBe(sub.options?.[0] ?? "");
    }
  });
});

describe("single-section descriptive types", () => {
  it("keeps non-settlement types in a single default section", () => {
    for (const type of ["region", "tavern", "shop", "faction"] as const) {
      const sections = realmSections(type);
      expect(sections).toHaveLength(1);
    }
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

describe("graph view", () => {
  it("has a color for every entity type", () => {
    for (const type of REALM_ENTITY_TYPES) {
      expect(REALM_TYPE_COLOR[type]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("layoutGraph", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const edges = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "d" },
  ];

  it("returns a position for every node, within bounds", () => {
    const pos = layoutGraph(nodes, edges, { width: 1000, height: 1000 });
    expect(Object.keys(pos).sort()).toEqual(["a", "b", "c", "d"]);
    for (const id of Object.keys(pos)) {
      expect(pos[id]!.x).toBeGreaterThanOrEqual(0);
      expect(pos[id]!.x).toBeLessThanOrEqual(1000);
      expect(pos[id]!.y).toBeGreaterThanOrEqual(0);
      expect(pos[id]!.y).toBeLessThanOrEqual(1000);
      expect(Number.isFinite(pos[id]!.x)).toBe(true);
      expect(Number.isFinite(pos[id]!.y)).toBe(true);
    }
  });

  it("is deterministic — identical input yields identical output", () => {
    const a = layoutGraph(nodes, edges);
    const b = layoutGraph(nodes, edges);
    expect(a).toEqual(b);
  });

  it("handles the empty graph", () => {
    expect(layoutGraph([], [])).toEqual({});
  });

  it("centers a single node", () => {
    expect(layoutGraph([{ id: "solo" }], [], { width: 800, height: 600 })).toEqual({
      solo: { x: 400, y: 300 },
    });
  });

  it("ignores edges referencing unknown nodes and self-loops", () => {
    const pos = layoutGraph([{ id: "a" }, { id: "b" }], [
      { source: "a", target: "a" },
      { source: "a", target: "ghost" },
      { source: "a", target: "b" },
    ]);
    expect(Object.keys(pos).sort()).toEqual(["a", "b"]);
  });
});
