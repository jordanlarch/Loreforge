import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const CAMPAIGN = "c:combat";

function scores(dex: number): AbilityScores {
  return { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 };
}

async function setupArena(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:arena", name: "Arena" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
  for (const [id, dex, speed] of [
    ["pc:thorin", 14, 25],
    ["pc:elara", 18, 30],
    ["npc:goblin", 12, 30],
  ] as const) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id,
        kind: id.startsWith("pc") ? "character" : "monster",
        name: id,
        abilityScores: scores(dex),
        maxHp: 20,
        baseAc: 13,
        speed,
        sceneId: "s:arena",
      },
    });
  }
}

const COMBATANTS = ["pc:thorin", "pc:elara", "npc:goblin"];

async function startAndRoll(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    combatants: COMBATANTS,
  });
  return engine.execute(CAMPAIGN, { type: "roll_initiative" });
}

describe("Combat: encounter + initiative", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1_700_000_000_000 });
    await setupArena(engine);
  });

  it("starts an encounter in the current scene without rolling initiative yet", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: COMBATANTS,
    });
    expect(result.accepted).toBe(true);
    const enc = (await engine.getState(CAMPAIGN)).encounter;
    expect(enc?.sceneId).toBe("s:arena");
    expect(enc?.initiativeRolled).toBe(false);
    expect(enc?.round).toBe(0);
    expect(enc?.combatants).toEqual(COMBATANTS);
    expect(enc?.order).toEqual([]);
  });

  it("rolls initiative into a descending order and opens round 1", async () => {
    await startAndRoll(engine);
    const enc = (await engine.getState(CAMPAIGN)).encounter;
    expect(enc?.initiativeRolled).toBe(true);
    expect(enc?.round).toBe(1);
    expect(enc?.order).toHaveLength(3);
    // Monotonic non-increasing initiative.
    const inits = enc!.order.map((o) => o.initiative);
    expect([...inits].sort((a, b) => b - a)).toEqual(inits);
    // Every combatant appears exactly once.
    expect(new Set(enc!.order.map((o) => o.entity))).toEqual(new Set(COMBATANTS));
  });

  it("records a DiceRolled (initiative + tiebreak) for every combatant", async () => {
    const result = await startAndRoll(engine);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      const diceRolls = result.events.filter((e) => e.type === "DiceRolled");
      expect(diceRolls).toHaveLength(COMBATANTS.length * 2);
    }
  });

  it("grants the first combatant a fresh action economy; others have none", async () => {
    await startAndRoll(engine);
    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter!.order[0]!.entity;
    expect(state.entities[active]?.actionEconomy).toEqual({
      action: "available",
      bonusAction: "available",
      reaction: "available",
      movement: { used: 0, total: state.entities[active]!.speed },
      freeInteractionUsed: false,
    });
    for (const other of COMBATANTS.filter((c) => c !== active)) {
      expect(state.entities[other]?.actionEconomy).toBeUndefined();
    }
  });
});

describe("Combat: turn + round advancement", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 42 });
    await setupArena(engine);
    await startAndRoll(engine);
  });

  it("ends a turn, resets the next combatant's economy, and clears the previous", async () => {
    const before = (await engine.getState(CAMPAIGN)).encounter!;
    const first = before.order[0]!.entity;
    const second = before.order[1]!.entity;

    const result = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(result.accepted).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.encounter?.activeIndex).toBe(1);
    expect(state.encounter?.round).toBe(1);
    expect(state.entities[first]?.actionEconomy).toBeUndefined();
    expect(state.entities[second]?.actionEconomy).toBeDefined();
  });

  it("wraps to the top of the order and increments the round", async () => {
    for (let i = 0; i < 3; i += 1) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
    }
    const enc = (await engine.getState(CAMPAIGN)).encounter;
    expect(enc?.activeIndex).toBe(0);
    expect(enc?.round).toBe(2);
  });

  it("emits RoundAdvanced only on wrap", async () => {
    const mid = await engine.execute(CAMPAIGN, { type: "end_turn" });
    if (mid.accepted) {
      expect(mid.events.some((e) => e.type === "RoundAdvanced")).toBe(false);
    }
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const wrap = await engine.execute(CAMPAIGN, { type: "end_turn" });
    if (wrap.accepted) {
      expect(wrap.events.some((e) => e.type === "RoundAdvanced")).toBe(true);
    }
  });
});

describe("Combat: determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 7 });
    await setupArena(engine);
    await startAndRoll(engine);
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    return engine;
  };

  it("two identical command streams converge to identical state", async () => {
    const a = await (await run()).getState(CAMPAIGN);
    const b = await (await run()).getState(CAMPAIGN);
    expect(a).toEqual(b);
  });

  it("rebuilding from the event log reproduces the live projection", async () => {
    const engine = await run();
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);
    const { rebuild } = await import("./projections/world-state");
    expect(rebuild(CAMPAIGN, events)).toEqual(live);
  });
});

describe("Combat: rejections", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupArena(engine);
  });

  it("rejects rolling initiative with no encounter", async () => {
    const r = await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NO_ENCOUNTER");
  });

  it("rejects ending a turn before initiative is rolled", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: COMBATANTS,
    });
    const r = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INITIATIVE_NOT_ROLLED");
  });

  it("rejects a second encounter while one is in progress", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: COMBATANTS,
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: COMBATANTS,
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("ENCOUNTER_EXISTS");
  });

  it("rejects rolling initiative twice", async () => {
    await startAndRoll(engine);
    const r = await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INITIATIVE_ALREADY_ROLLED");
  });

  it("rejects an empty encounter", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: [],
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("EMPTY_ENCOUNTER");
  });

  it("rejects duplicate combatants", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:thorin", "pc:thorin"],
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects an unknown combatant", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:ghost"],
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("TARGET_NOT_FOUND");
  });
});
