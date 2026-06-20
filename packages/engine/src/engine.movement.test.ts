import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 12,
  dex: 12,
  con: 12,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:move";

async function placeEntity(
  engine: Engine,
  id: string,
  position: GridPosition,
  speed = 30,
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp: 20,
      baseAc: 13,
      speed,
      sceneId: "s:map",
      position,
    },
  });
}

/** 10x10 scene with a wall at (3,0); fighter at (0,0), blocker at (1,1). */
async function setupMap(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:map",
      name: "Bridge",
      map: { width: 10, height: 10, blockedCells: [{ x: 3, y: 0 }] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
  await placeEntity(engine, "pc:fighter", { x: 0, y: 0 });
  await placeEntity(engine, "npc:blocker", { x: 1, y: 1 });
}

describe("Combat: movement budget + occupancy", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 5 });
    await setupMap(engine);
    // Solo encounter so the active combatant is deterministically the fighter.
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:fighter"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
  });

  it("debits the movement budget by 5-5-5 distance", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 2, y: 2 },
    });
    expect(result.accepted).toBe(true);
    const fighter = (await engine.getState(CAMPAIGN)).entities["pc:fighter"];
    expect(fighter?.position).toEqual({ x: 2, y: 2 });
    expect(fighter?.actionEconomy?.movement).toEqual({ used: 10, total: 30 });
  });

  it("rejects a move into an occupied cell", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 1, y: 1 },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("CELL_OCCUPIED");
  });

  it("rejects a move into a wall", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 3, y: 0 },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("CELL_BLOCKED");
  });

  it("rejects an out-of-bounds move", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 10, y: 0 },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("OUT_OF_BOUNDS");
  });

  it("rejects a move beyond remaining movement", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 0, y: 7 }, // 35ft > 30ft speed
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INSUFFICIENT_MOVEMENT");
  });

  it("rebuilding from the log preserves the debited movement", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 1, y: 0 },
    });
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);
    const { rebuild } = await import("./projections/world-state");
    expect(rebuild(CAMPAIGN, events)).toEqual(live);
  });
});

describe("Combat: movement outside an encounter", () => {
  it("allows unbudgeted movement when no action economy is in play", async () => {
    const engine = new Engine({ now: () => 5 });
    await setupMap(engine);
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:fighter",
      to: { x: 0, y: 9 }, // 45ft, no budget enforced off the clock
    });
    expect(r.accepted).toBe(true);
    const fighter = (await engine.getState(CAMPAIGN)).entities["pc:fighter"];
    expect(fighter?.actionEconomy).toBeUndefined();
    expect(fighter?.position).toEqual({ x: 0, y: 9 });
  });
});

describe("Combat: line of sight on attacks", () => {
  async function arena(blockedCells: GridPosition[]) {
    const engine = new Engine({ now: () => 9 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:map",
        name: "Hall",
        map: { width: 10, height: 10, blockedCells },
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
    await placeEntity(engine, "pc:archer", { x: 0, y: 0 });
    await placeEntity(engine, "npc:orc", { x: 4, y: 0 });
    return engine;
  }

  it("blocks an attack when a wall stands between attacker and target", async () => {
    const engine = await arena([{ x: 2, y: 0 }]);
    const r = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:archer",
      target: "npc:orc",
      attackBonus: 5,
      damage: { notation: "1d8", type: "piercing" },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NO_LINE_OF_SIGHT");
  });

  it("permits an attack with a clear line of sight", async () => {
    const engine = await arena([]);
    const r = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:archer",
      target: "npc:orc",
      attackBonus: 5,
      damage: { notation: "1d8", type: "piercing" },
    });
    expect(r.accepted).toBe(true);
  });
});
