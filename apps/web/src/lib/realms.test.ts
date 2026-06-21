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
  isCascadeParent,
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

describe("rich Tavern schema", () => {
  it("groups tavern fields into ordered sections (tabs)", () => {
    const sections = realmSections("tavern");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Menu");
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.tavern.length);
  });

  it("preserves the original thin keys so legacy taverns stay valid", () => {
    const keys = REALM_FIELDS.tavern.map((f) => f.key);
    for (const legacy of ["proprietor", "specialty", "atmosphere", "notes"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("declares a structured menu group with category options", () => {
    const menu = REALM_FIELDS.tavern.find((f) => f.key === "menu");
    expect(menu?.kind).toBe("group");
    const category = (menu?.fields ?? []).find((s) => s.key === "category");
    expect(category?.kind).toBe("select");
    expect(category?.options).toContain("Drink");
  });

  it("is a cascade parent so generation emits child NPC stubs", () => {
    expect(isCascadeParent("tavern")).toBe(true);
  });
});

describe("rich Shop schema", () => {
  it("groups shop fields into ordered sections (tabs)", () => {
    const sections = realmSections("shop");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Inventory");
    expect(sections.map((s) => s.name)).toContain("Loot & Security");
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.shop.length);
  });

  it("preserves the original thin keys so legacy shops stay valid", () => {
    const keys = REALM_FIELDS.shop.map((f) => f.key);
    for (const legacy of ["kind", "proprietor", "wares", "priceLevel"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("declares a structured inventory group with type and rarity options", () => {
    const inventory = REALM_FIELDS.shop.find((f) => f.key === "inventory");
    expect(inventory?.kind).toBe("group");
    const itemType = (inventory?.fields ?? []).find((s) => s.key === "itemType");
    expect(itemType?.kind).toBe("select");
    expect(itemType?.options).toContain("Weapon");
    const rarity = (inventory?.fields ?? []).find((s) => s.key === "rarity");
    expect(rarity?.options).toContain("Legendary");
  });

  it("keeps the price-level select options so legacy values validate", () => {
    const priceLevel = REALM_FIELDS.shop.find((f) => f.key === "priceLevel");
    expect(priceLevel?.kind).toBe("select");
    expect(priceLevel?.options).toEqual([
      "Cheap",
      "Modest",
      "Expensive",
      "Luxury",
    ]);
  });

  it("is a cascade parent so generation emits child NPC stubs", () => {
    expect(isCascadeParent("shop")).toBe(true);
  });
});

describe("rich Building schema", () => {
  it("groups building fields into ordered sections (tabs)", () => {
    const sections = realmSections("building");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Architecture");
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.building.length);
  });

  it("preserves the original thin keys so legacy buildings stay valid", () => {
    const keys = REALM_FIELDS.building.map((f) => f.key);
    for (const legacy of ["kind", "occupants", "notes"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("declares condition and size as selects with options", () => {
    const byKey = new Map(REALM_FIELDS.building.map((f) => [f.key, f]));
    expect(byKey.get("condition")?.kind).toBe("select");
    expect(byKey.get("condition")?.options).toContain("Haunted");
    expect(byKey.get("size")?.kind).toBe("select");
  });

  it("is a cascade parent so generation emits child NPC stubs", () => {
    expect(isCascadeParent("building")).toBe(true);
  });
});

describe("rich Faction schema", () => {
  it("groups faction fields into ordered sections (tabs)", () => {
    const sections = realmSections("faction");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Goals & Methods");
    expect(sections.map((s) => s.name)).toContain("Relationships");
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.faction.length);
  });

  it("preserves the original thin keys so legacy factions stay valid", () => {
    const keys = REALM_FIELDS.faction.map((f) => f.key);
    for (const legacy of ["kind", "leadership", "goals", "influence"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("keeps the influence select options so legacy values validate", () => {
    const influence = REALM_FIELDS.faction.find((f) => f.key === "influence");
    expect(influence?.kind).toBe("select");
    expect(influence?.options).toEqual([
      "Local",
      "Regional",
      "National",
      "Continental",
    ]);
  });

  it("declares ally and rival lists for the relationship graph", () => {
    const byKey = new Map(REALM_FIELDS.faction.map((f) => [f.key, f]));
    expect(byKey.get("allies")?.kind).toBe("list");
    expect(byKey.get("rivals")?.kind).toBe("list");
  });

  it("is a cascade parent so generation emits child NPC stubs", () => {
    expect(isCascadeParent("faction")).toBe(true);
  });
});

describe("rich Dungeon schema", () => {
  it("groups dungeon fields into ordered sections (tabs)", () => {
    const sections = realmSections("dungeon");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.name).toBe("Overview");
    expect(sections.map((s) => s.name)).toContain("Rooms");
    const total = sections.reduce((n, s) => n + s.fields.length, 0);
    expect(total).toBe(REALM_FIELDS.dungeon.length);
  });

  it("preserves the original thin keys so legacy dungeons stay valid", () => {
    const keys = REALM_FIELDS.dungeon.map((f) => f.key);
    for (const legacy of ["kind", "depth", "threat", "hook"]) {
      expect(keys).toContain(legacy);
    }
  });

  it("declares a structured rooms group with an encounter seam", () => {
    const rooms = REALM_FIELDS.dungeon.find((f) => f.key === "rooms");
    expect(rooms?.kind).toBe("group");
    const subKeys = (rooms?.fields ?? []).map((s) => s.key);
    expect(subKeys).toContain("encounter");
    expect(subKeys).toContain("description");
  });

  it("keeps the threat select options so legacy values validate", () => {
    const threat = REALM_FIELDS.dungeon.find((f) => f.key === "threat");
    expect(threat?.kind).toBe("select");
    expect(threat?.options).toEqual(["Low", "Moderate", "Deadly"]);
  });

  it("is a cascade parent so generation emits child NPC stubs", () => {
    expect(isCascadeParent("dungeon")).toBe(true);
  });
});

describe("single-section descriptive types", () => {
  it("keeps non-sectioned types in a single default section", () => {
    for (const type of ["region"] as const) {
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
