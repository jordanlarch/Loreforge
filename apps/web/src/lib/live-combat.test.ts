import { describe, expect, it } from "vitest";

import type { EntityState, WorldState } from "@app/engine";

import {
  castableSpellsFor,
  controllableReactors,
  deriveStrike,
  gridDistanceFeet,
  reactionWindowKey,
  targetsInRange,
} from "./live-combat";

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

function world(entities: EntityState[], sides: Record<string, string>): WorldState {
  return {
    campaignId: "c1",
    lastSequence: 1,
    scenes: {},
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    encounter: {
      sceneId: "s1",
      combatants: entities.map((e) => e.id),
      sides,
      order: [],
      initiativeRolled: true,
      round: 1,
      activeIndex: 0,
    },
  };
}

describe("deriveStrike", () => {
  it("uses the better of STR/DEX plus proficiency", () => {
    const e = entity({
      id: "hero",
      abilityScores: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 3,
    });
    const s = deriveStrike(e);
    expect(s.attackBonus).toBe(6); // +3 STR + 3 prof
    expect(s.damage.notation).toBe("1d8+3");
  });

  it("omits a +0 modifier from the damage notation", () => {
    expect(deriveStrike(entity({ id: "x" })).damage.notation).toBe("1d8");
  });
});

describe("gridDistanceFeet", () => {
  it("uses Chebyshev distance × 5", () => {
    expect(gridDistanceFeet({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(15);
    expect(gridDistanceFeet({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });
});

describe("castableSpellsFor", () => {
  it("returns nothing for a non-caster", () => {
    expect(castableSpellsFor(entity({ id: "x" }))).toEqual([]);
  });

  it("offers cantrips always and leveled spells only with a free slot", () => {
    const noSlots = entity({
      id: "c",
      spellcasting: { ability: "cha", slots: { 1: { max: 2, current: 0 } } },
    });
    expect(castableSpellsFor(noSlots).map((s) => s.id)).toEqual([
      "fire-bolt",
      "sacred-flame",
    ]);

    const withSlot = entity({
      id: "c2",
      spellcasting: { ability: "cha", slots: { 1: { max: 2, current: 1 } } },
    });
    expect(castableSpellsFor(withSlot).map((s) => s.id)).toContain("guiding-bolt");
  });
});

describe("targetsInRange", () => {
  const hero = entity({ id: "hero", position: { x: 0, y: 0 } });
  const near = entity({ id: "goblin-near", position: { x: 1, y: 0 } });
  const far = entity({ id: "goblin-far", position: { x: 8, y: 0 } });
  const ally = entity({ id: "ally", position: { x: 1, y: 1 } });
  const w = world([hero, near, far, ally], {
    hero: "party",
    "goblin-near": "foes",
    "goblin-far": "foes",
    ally: "party",
  });

  it("includes only hostile entities within range", () => {
    const reach = targetsInRange(w, "hero", 5).map((e) => e.id);
    expect(reach).toEqual(["goblin-near"]);
  });

  it("widens with range and never includes allies", () => {
    const ranged = targetsInRange(w, "hero", 120).map((e) => e.id);
    expect(ranged).toContain("goblin-near");
    expect(ranged).toContain("goblin-far");
    expect(ranged).not.toContain("ally");
  });
});

describe("reaction window helpers", () => {
  const mover = entity({ id: "goblin", position: { x: 5, y: 5 } });
  const reactor = entity({ id: "hero", position: { x: 5, y: 4 } });
  const base = world([mover, reactor], { goblin: "foes", hero: "party" });
  const w: WorldState = {
    ...base,
    encounter: {
      ...base.encounter!,
      reactionWindow: { mover: "goblin", eligible: ["hero"] },
    },
  };

  it("surfaces reactors on the controlled side", () => {
    const r = controllableReactors(w, "party");
    expect(r).toHaveLength(1);
    expect(r[0]!.reactor.id).toBe("hero");
    expect(r[0]!.mover.id).toBe("goblin");
  });

  it("ignores reactors on other sides", () => {
    expect(controllableReactors(w, "foes")).toHaveLength(0);
  });

  it("builds a stable, order-independent key", () => {
    expect(reactionWindowKey(w)).toBe("goblin:hero");
    expect(reactionWindowKey(base)).toBeNull();
  });
});
