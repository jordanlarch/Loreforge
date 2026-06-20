import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";
import type { ReactionWindowOpenedPayload } from "./events/types";

const ABILITIES: AbilityScores = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:react";

async function place(
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
      maxHp: 100_000,
      baseAc: 12,
      speed,
      sceneId: "s:map",
      position,
    },
  });
}

async function setup(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:map",
      name: "Hall",
      map: { width: 10, height: 10, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
  await place(engine, "pc:hero", { x: 0, y: 0 });
  await place(engine, "npc:foe", { x: 1, y: 0 }); // adjacent (5 ft)
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    combatants: ["pc:hero", "npc:foe"],
    sides: { "pc:hero": "party", "npc:foe": "enemies" },
  });
  await engine.execute(CAMPAIGN, { type: "roll_initiative" });
}

async function ent(engine: Engine, id: string) {
  return (await engine.getState(CAMPAIGN)).entities[id];
}

const OA = {
  attackBonus: 50, // guarantees a hit except on a natural 1
  damage: { notation: "1d6", type: "slashing" },
} as const;

describe("Reactions: budget", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
  });

  it("grants every combatant a reaction when combat begins", async () => {
    expect((await ent(engine, "pc:hero"))?.reaction).toBe("available");
    expect((await ent(engine, "npc:foe"))?.reaction).toBe("available");
  });
});

describe("Reactions: opportunity attacks", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
  });

  it("opens a window when a combatant leaves a threatener's reach", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 }, // 10 ft from the foe
    });
    expect(r.accepted).toBe(true);
    if (!r.accepted) return;
    const opened = r.events.find((e) => e.type === "ReactionWindowOpened");
    expect(opened).toBeDefined();
    const payload = (opened as { payload: ReactionWindowOpenedPayload }).payload;
    expect(payload.mover).toBe("pc:hero");
    expect(payload.eligible).toContain("npc:foe");
  });

  it("does not open a window when moving within reach", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 1 }, // still adjacent (5 ft diagonal)
    });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
  });

  it("resolves an opportunity attack and spends the reactor's reaction", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "AttackResolved")).toBeDefined();
      expect(r.events.find((e) => e.type === "ReactionTaken")).toBeDefined();
    }
    expect((await ent(engine, "npc:foe"))?.reaction).toBe("used");
  });

  it("enforces one reaction per round", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    // Hero steps adjacent then leaves again; foe has no reaction left.
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 1, y: 1 }, // adjacent to foe again
    });
    const move = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 3, y: 3 }, // leaves reach
    });
    // No window because the foe's reaction is spent.
    if (move.accepted) {
      expect(move.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
    const second = await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    expect(second.accepted).toBe(false);
    if (!second.accepted) expect(second.reason.code).toBe("NO_REACTION");
  });

  it("rejects an opportunity attack with no open window", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NOT_PROVOKED");
  });

  it("refreshes the reaction at the start of the owner's next turn", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    expect((await ent(engine, "npc:foe"))?.reaction).toBe("used");

    // Cycle turns until the foe's turn comes around again.
    for (let i = 0; i < 4; i++) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      if ((await ent(engine, "npc:foe"))?.reaction === "available") break;
    }
    expect((await ent(engine, "npc:foe"))?.reaction).toBe("available");
  });
});

describe("Reactions: side / hostility filtering", () => {
  let engine: Engine;

  /** Scene + adjacent hero/foe + encounter with the given side assignment. */
  async function arena(sides?: Record<string, string>) {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:map",
        name: "Hall",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
    await place(engine, "pc:hero", { x: 0, y: 0 });
    await place(engine, "npc:foe", { x: 1, y: 0 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero", "npc:foe"],
      ...(sides ? { sides } : {}),
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
  }

  async function leaveReach() {
    return engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
  }

  beforeEach(() => {
    engine = new Engine({ now: () => 1 });
  });

  it("opens a window between hostile sides", async () => {
    await arena({ "pc:hero": "party", "npc:foe": "enemies" });
    const r = await leaveReach();
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "ReactionWindowOpened")).toBeDefined();
    }
  });

  it("does not open a window for an allied (same-side) combatant", async () => {
    await arena({ "pc:hero": "party", "npc:foe": "party" });
    const r = await leaveReach();
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
  });

  it("does not open a window when sides are unassigned (neutral)", async () => {
    await arena(); // no sides
    const r = await leaveReach();
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
  });

  it("treats a one-sided assignment as neutral (no window)", async () => {
    await arena({ "pc:hero": "party" }); // foe has no side
    const r = await leaveReach();
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
  });

  it("rejects a side assigned to a non-combatant", async () => {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:map", name: "Hall" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
    await place(engine, "pc:hero", { x: 0, y: 0 });
    await place(engine, "npc:foe", { x: 1, y: 0 });
    const r = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero"],
      sides: { "npc:foe": "enemies" },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INVALID_PAYLOAD");
  });
});

describe("Reactions: ready action", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
  });

  async function activeId() {
    const state = await engine.getState(CAMPAIGN);
    const enc = state.encounter!;
    return enc.order[enc.activeIndex]!.entity;
  }

  it("readies an action, spending the action and storing the trigger", async () => {
    const actor = await activeId();
    const other = actor === "pc:hero" ? "npc:foe" : "pc:hero";
    const r = await engine.execute(CAMPAIGN, {
      type: "ready_action",
      entity: actor,
      trigger: "when the foe enters reach",
      action: { kind: "attack", target: other, ...OA },
    });
    expect(r.accepted).toBe(true);
    const e = await ent(engine, actor);
    expect(e?.readied?.trigger).toBe("when the foe enters reach");
    expect(e?.actionEconomy?.action).toBe("used");
  });

  it("rejects readying when it is not the entity's turn", async () => {
    const actor = await activeId();
    const other = actor === "pc:hero" ? "npc:foe" : "pc:hero";
    const r = await engine.execute(CAMPAIGN, {
      type: "ready_action",
      entity: other,
      trigger: "later",
      action: { kind: "attack", target: actor, ...OA },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("ACTION_UNAVAILABLE");
  });

  it("resolves a readied action, spending the reaction and clearing it", async () => {
    const actor = await activeId();
    const other = actor === "pc:hero" ? "npc:foe" : "pc:hero";
    await engine.execute(CAMPAIGN, {
      type: "ready_action",
      entity: actor,
      trigger: "trigger",
      action: { kind: "attack", target: other, ...OA },
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "trigger_readied",
      entity: actor,
    });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.events.find((e) => e.type === "AttackResolved")).toBeDefined();
      expect(r.events.find((e) => e.type === "ReadiedActionTriggered")).toBeDefined();
    }
    const e = await ent(engine, actor);
    expect(e?.readied).toBeUndefined();
    expect(e?.reaction).toBe("used");
  });

  it("rejects triggering when there is no readied action", async () => {
    const actor = await activeId();
    const r = await engine.execute(CAMPAIGN, {
      type: "trigger_readied",
      entity: actor,
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NO_READIED_ACTION");
  });

  it("lapses a readied action at the start of the owner's next turn", async () => {
    const actor = await activeId();
    const other = actor === "pc:hero" ? "npc:foe" : "pc:hero";
    await engine.execute(CAMPAIGN, {
      type: "ready_action",
      entity: actor,
      trigger: "trigger",
      action: { kind: "attack", target: other, ...OA },
    });
    expect((await ent(engine, actor))?.readied).toBeDefined();

    for (let i = 0; i < 4; i++) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      if ((await ent(engine, actor))?.readied === undefined) break;
    }
    expect((await ent(engine, actor))?.readied).toBeUndefined();
  });

  it("is deterministic across replay", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    await engine.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    const first = await ent(engine, "pc:hero");

    const replay = new Engine({ now: () => 1 });
    await setup(replay);
    await replay.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    await replay.execute(CAMPAIGN, {
      type: "opportunity_attack",
      reactor: "npc:foe",
      target: "pc:hero",
      ...OA,
    });
    const second = await ent(replay, "pc:hero");
    expect(second?.hp.current).toBe(first?.hp.current);
  });
});
