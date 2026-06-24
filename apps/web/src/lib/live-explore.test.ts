import { describe, expect, it } from "vitest";

import type { EntityState, WorldState } from "@app/engine";

import { buildExploreModel } from "./live-explore";

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
    position: { x: 1, y: 2 },
    ...over,
  };
}

function world(
  entities: EntityState[],
  opts: { withMap?: boolean; withEncounter?: boolean } = {},
): WorldState {
  const withMap = opts.withMap ?? true;
  const base: WorldState = {
    campaignId: "c1",
    lastSequence: 1,
    currentSceneId: "s1",
    scenes: {
      s1: {
        id: "s1",
        name: "The Hollow's Edge",
        description: "A rain-wet road.",
        ...(withMap
          ? { map: { width: 12, height: 10, blockedCells: [{ x: 2, y: 2 }] } }
          : {}),
      },
    },
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
  } as WorldState;
  if (!opts.withEncounter) return base;
  return {
    ...base,
    encounter: {
      sceneId: "s1",
      combatants: entities.map((e) => e.id),
      sides: {},
      order: entities.map((e) => ({ entity: e.id, initiative: 10 })),
      initiativeRolled: true,
      round: 1,
      activeIndex: 0,
    },
  } as WorldState;
}

describe("buildExploreModel", () => {
  it("returns the static board for a mapped scene with no encounter", () => {
    const model = buildExploreModel(world([entity({ id: "mira" })]));
    expect(model).not.toBeNull();
    expect(model!.cols).toBe(12);
    expect(model!.rows).toBe(10);
    expect(model!.walls).toHaveLength(1);
    expect(model!.sceneName).toBe("The Hollow's Edge");
    expect(model!.sceneDescription).toBe("A rain-wet road.");
  });

  it("renders placed entities as neutral, static tokens", () => {
    const model = buildExploreModel(world([entity({ id: "mira" })]));
    expect(model!.tokens).toHaveLength(1);
    const token = model!.tokens[0]!;
    expect(token.id).toBe("mira");
    expect(token.position).toEqual({ x: 1, y: 2 });
    expect(token.hostile).toBe(false);
    expect(token.isActive).toBe(false);
    expect(token.draggable).toBe(false);
    expect(token.interactive).toBe(false);
  });

  it("marks npc and companion tokens as tappable in exploration", () => {
    const model = buildExploreModel(
      world([
        entity({ id: "mira", kind: "character" }),
        entity({ id: "npc:brennar", kind: "character", name: "Old Brennar" }),
        entity({ id: "npc:tut-barnaby", kind: "npc", name: "Barnaby" }),
      ]),
    );
    const byId = Object.fromEntries(model!.tokens.map((t) => [t.id, t]));
    expect(byId.mira?.interactive).toBe(false);
    expect(byId["npc:brennar"]?.interactive).toBe(true);
    expect(byId["npc:tut-barnaby"]?.interactive).toBe(true);
  });

  it("only includes placed entities in the current scene", () => {
    const here = entity({ id: "here" });
    const elsewhere = entity({ id: "elsewhere", sceneId: "s2" });
    const unplaced = entity({ id: "unplaced", position: undefined });
    const model = buildExploreModel(world([here, elsewhere, unplaced]));
    expect(model!.tokens.map((t) => t.id)).toEqual(["here"]);
  });

  it("is null while an encounter is active (combat owns the board)", () => {
    const w = world([entity({ id: "mira" })], { withEncounter: true });
    expect(buildExploreModel(w)).toBeNull();
  });

  it("is null when the scene has no map", () => {
    const w = world([entity({ id: "mira" })], { withMap: false });
    expect(buildExploreModel(w)).toBeNull();
  });
});
