import { describe, expect, it } from "vitest";

import type { EntityState, WorldState } from "@app/engine";

import { activeMemberId, hpPercent, partyMembers, partyMembersWithRoster } from "./live-party";

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
    saveProficiencies: [],
    skillProficiencies: [],
    alive: true,
    conditions: [],
    dead: false,
    sceneId: "s1",
    position: { x: 0, y: 0 },
    ...over,
  };
}

function world(
  entities: EntityState[],
  opts: {
    sides?: Record<string, string>;
    order?: string[];
    activeIndex?: number;
    withEncounter?: boolean;
  } = {},
): WorldState {
  const withEncounter = opts.withEncounter ?? true;
  const base: WorldState = {
    campaignId: "c1",
    lastSequence: 1,
    currentSceneId: "s1",
    scenes: {
      s1: {
        id: "s1",
        name: "Arena",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    },
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
  } as WorldState;
  if (!withEncounter) return base;
  return {
    ...base,
    encounter: {
      sceneId: "s1",
      combatants: entities.map((e) => e.id),
      sides: opts.sides ?? {},
      order: (opts.order ?? entities.map((e) => e.id)).map((id) => ({
        entity: id,
        initiative: 10,
      })),
      initiativeRolled: true,
      surpriseResolved: false,
      round: 1,
      activeIndex: opts.activeIndex ?? 0,
    },
  } as WorldState;
}

describe("partyMembers", () => {
  it("includes party-side + allied NPCs and excludes hostiles (in combat)", () => {
    const hero = entity({ id: "hero" });
    const ally = entity({ id: "ally", kind: "npc" });
    const goblin = entity({ id: "goblin", kind: "monster" });
    const w = world([hero, goblin, ally], {
      sides: { hero: "party", ally: "party", goblin: "foes" },
    });
    expect(partyMembers(w).map((m) => m.id)).toEqual(["hero", "ally"]);
  });

  it("sorts PCs before allied NPCs, alphabetical within each group", () => {
    const zara = entity({ id: "zara" });
    const bron = entity({ id: "bron" });
    const maddy = entity({ id: "maddy", kind: "npc" });
    const w = world([zara, maddy, bron], {
      sides: { zara: "party", bron: "party", maddy: "party" },
    });
    expect(partyMembers(w).map((m) => m.id)).toEqual(["bron", "zara", "maddy"]);
  });

  it("falls back to placed PCs when there is no encounter", () => {
    const hero = entity({ id: "hero" });
    const npc = entity({ id: "barkeep", kind: "npc" });
    const w = world([hero, npc], { withEncounter: false });
    expect(partyMembers(w).map((m) => m.id)).toEqual(["hero"]);
  });

  it("only counts entities in the current scene", () => {
    const here = entity({ id: "here" });
    const elsewhere = entity({ id: "elsewhere", sceneId: "s2" });
    const w = world([here, elsewhere], {
      sides: { here: "party", elsewhere: "party" },
    });
    expect(partyMembers(w).map((m) => m.id)).toEqual(["here"]);
  });

  it("returns nothing when no scene is active", () => {
    const hero = entity({ id: "hero" });
    const w = { ...world([hero]), currentSceneId: undefined } as WorldState;
    expect(partyMembers(w)).toEqual([]);
  });
});

describe("partyMembersWithRoster", () => {
  it("backfills an active companion from the DB roster when the engine entity is missing", () => {
    const hero = entity({ id: "hero", name: "Mira" });
    const w = world([hero], { withEncounter: false });
    const merged = partyMembersWithRoster(w, [
      {
        id: "char-brennar",
        name: "Old Brennar",
        role: "companion",
        status: "active",
        maxHp: 17,
        baseAc: 13,
        speed: 30,
        abilityScores: hero.abilityScores,
        classes: [{ class: "Cleric", level: 2 }],
      },
    ]);
    expect(merged.map((m) => m.name)).toEqual(["Mira", "Old Brennar"]);
  });

  it("injects Brennar when the hook was accepted but neither DB nor engine has synced", () => {
    const hero = entity({ id: "hero", name: "Mira" });
    const w = world([hero], { withEncounter: false });
    const merged = partyMembersWithRoster(w, undefined, {
      companionExpected: true,
    });
    expect(merged.map((m) => m.name)).toEqual(["Mira", "Old Brennar"]);
  });
});

describe("activeMemberId", () => {
  it("reads the active combatant from the initiative order", () => {
    const a = entity({ id: "a" });
    const b = entity({ id: "b" });
    const w = world([a, b], {
      sides: { a: "party", b: "party" },
      order: ["a", "b"],
      activeIndex: 1,
    });
    expect(activeMemberId(w)).toBe("b");
  });

  it("is undefined outside of combat", () => {
    const a = entity({ id: "a" });
    const w = world([a], { withEncounter: false });
    expect(activeMemberId(w)).toBeUndefined();
  });
});

describe("hpPercent", () => {
  it("clamps to 0–100 and rounds", () => {
    expect(hpPercent({ current: 5, max: 10 })).toBe(50);
    expect(hpPercent({ current: 1, max: 3 })).toBe(33);
    expect(hpPercent({ current: 0, max: 10 })).toBe(0);
    expect(hpPercent({ current: 20, max: 10 })).toBe(100);
  });

  it("guards against a zero max", () => {
    expect(hpPercent({ current: 0, max: 0 })).toBe(0);
  });
});
