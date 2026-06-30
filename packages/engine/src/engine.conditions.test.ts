import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";
import type {
  AttackResolvedPayload,
  CheckRolledPayload,
  SaveRolledPayload,
} from "./events/types";

const ABILITIES: AbilityScores = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:cond";

async function place(engine: Engine, id: string, position: GridPosition) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp: 100_000,
      baseAc: 12,
      speed: 30,
      sceneId: "s:1",
      position,
    },
  });
}

async function setup(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Arena" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await place(engine, "pc:hero", { x: 0, y: 0 });
  await place(engine, "npc:foe", { x: 1, y: 0 }); // adjacent (5 ft)
}

async function attack(
  engine: Engine,
  attacker = "pc:hero",
  target = "npc:foe",
  rangeFt?: number,
) {
  const r = await engine.execute(CAMPAIGN, {
    type: "attack",
    attacker,
    target,
    attackBonus: 50, // guarantees a hit except on a natural 1
    damage: { notation: "1d6", type: "slashing" },
    ...(rangeFt !== undefined ? { rangeFt } : {}),
  });
  return r;
}

function attackPayload(
  r: Awaited<ReturnType<typeof attack>>,
): AttackResolvedPayload {
  if (!r.accepted) throw new Error("attack rejected");
  const e = r.events.find((ev) => ev.type === "AttackResolved");
  return (e as { payload: AttackResolvedPayload }).payload;
}

describe("Conditions: apply / remove state", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
  });

  it("applies and removes a condition, reflected in the projection", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "poisoned",
    });
    let foe = (await engine.getState(CAMPAIGN)).entities["npc:foe"];
    expect(foe?.conditions.map((c) => c.condition)).toEqual(["poisoned"]);

    await engine.execute(CAMPAIGN, {
      type: "remove_condition",
      target: "npc:foe",
      condition: "poisoned",
    });
    foe = (await engine.getState(CAMPAIGN)).entities["npc:foe"];
    expect(foe?.conditions).toEqual([]);
  });

  it("does not duplicate a re-applied condition and updates exhaustion level", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "exhaustion",
      level: 1,
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "exhaustion",
      level: 3,
    });
    const foe = (await engine.getState(CAMPAIGN)).entities["npc:foe"];
    expect(foe?.conditions).toEqual([{ condition: "exhaustion", level: 3 }]);
  });

  it("rejects an unknown target", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:ghost",
      condition: "prone",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("TARGET_NOT_FOUND");
  });
});

describe("Conditions: attack-roll modes", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 2 });
    await setup(engine);
  });

  const applyTo = async (target: string, condition: string, source?: string) =>
    engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target,
      condition: condition as never,
      ...(source ? { source } : {}),
    });

  it("poisoned attacker rolls with disadvantage", async () => {
    await applyTo("pc:hero", "poisoned");
    expect(attackPayload(await attack(engine)).attackRoll.mode).toBe(
      "disadvantage",
    );
  });

  it("attacks against a restrained target have advantage", async () => {
    await applyTo("npc:foe", "restrained");
    expect(attackPayload(await attack(engine)).attackRoll.mode).toBe(
      "advantage",
    );
  });

  it("invisible target imposes disadvantage on attackers", async () => {
    await applyTo("npc:foe", "invisible");
    expect(attackPayload(await attack(engine)).attackRoll.mode).toBe(
      "disadvantage",
    );
  });

  it("advantage and disadvantage cancel to normal", async () => {
    await applyTo("pc:hero", "poisoned"); // disadvantage
    await applyTo("npc:foe", "restrained"); // advantage
    expect(attackPayload(await attack(engine)).attackRoll.mode).toBe("normal");
  });

  it("a melee hit on an adjacent paralyzed target is a crit", async () => {
    await applyTo("npc:foe", "paralyzed");
    const p = attackPayload(await attack(engine));
    expect(p.attackRoll.mode).toBe("advantage");
    // Adjacent + paralyzed ⇒ any hit is a crit (a nat-1 still misses).
    expect(!p.hit || p.critical).toBe(true);
  });

  it("a prone target gives a distant attacker disadvantage", async () => {
    await place(engine, "pc:archer", { x: 6, y: 0 }); // 30 ft away
    await applyTo("npc:foe", "prone");
    const r = await attack(engine, "pc:archer", "npc:foe", 30);
    expect(attackPayload(r).attackRoll.mode).toBe("disadvantage");
  });
});

describe("Conditions: action and movement availability", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 3 });
    await setup(engine);
  });

  it("an incapacitated creature cannot attack", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "stunned",
    });
    const r = await attack(engine);
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("ACTION_UNAVAILABLE");
  });

  it("a charmed creature cannot attack its charmer", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "charmed",
      source: "npc:foe",
    });
    const r = await attack(engine);
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("INVALID_TARGET");
  });

  it("a grappled creature cannot move", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "grappled",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 1 },
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("IMMOBILIZED");
  });

  it("incapacitation marks the action economy as lost on the active turn", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "stunned",
    });
    let hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"];
    expect(hero?.actionEconomy?.action).toBe("lost");
    expect(hero?.reaction).toBe("lost");
    // Movement is blocked by the speed-0 check regardless of the budget number.
    const blockedMove = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 1 },
    });
    expect(blockedMove.accepted).toBe(false);
    if (!blockedMove.accepted) {
      expect(blockedMove.reason.code).toBe("IMMOBILIZED");
    }

    await engine.execute(CAMPAIGN, {
      type: "remove_condition",
      target: "pc:hero",
      condition: "stunned",
    });
    hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"];
    expect(hero?.actionEconomy?.action).toBe("available");
    expect(hero?.reaction).toBe("available");
  });
});

describe("Conditions: saving throws", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 4 });
    await setup(engine);
  });

  const savePayload = (r: Awaited<ReturnType<Engine["execute"]>>) => {
    if (!r.accepted) throw new Error("save rejected");
    const e = r.events.find((ev) => ev.type === "SaveRolled");
    return (e as { payload: SaveRolledPayload }).payload;
  };

  it("auto-fails a STR save while paralyzed without consuming a roll", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "paralyzed",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "npc:foe",
      ability: "str",
      dc: 5,
    });
    const p = savePayload(r);
    expect(p.autoFail).toBe(true);
    expect(p.success).toBe(false);
    if (r.accepted) {
      expect(r.events.some((e) => e.type === "DiceRolled")).toBe(false);
    }
  });

  it("rolls a DEX save with disadvantage while restrained", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "restrained",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "npc:foe",
      ability: "dex",
      dc: 10,
    });
    expect(savePayload(r).mode).toBe("disadvantage");
  });

  it("resolves success against a low DC and failure against a high DC", async () => {
    const low = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:hero",
      ability: "con",
      dc: 1,
    });
    const high = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:hero",
      ability: "con",
      dc: 99,
    });
    expect(savePayload(low).success).toBe(true);
    expect(savePayload(high).success).toBe(false);
  });
});

describe("Exhaustion (SRD 5.2.1 uniform model)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 7 });
    await setup(engine);
  });

  const savePayload = (r: Awaited<ReturnType<Engine["execute"]>>) => {
    if (!r.accepted) throw new Error("save rejected");
    const e = r.events.find((ev) => ev.type === "SaveRolled");
    return (e as { payload: SaveRolledPayload }).payload;
  };
  const checkPayload = (r: Awaited<ReturnType<Engine["execute"]>>) => {
    if (!r.accepted) throw new Error("check rejected");
    const e = r.events.find((ev) => ev.type === "CheckRolled");
    return (e as { payload: CheckRolledPayload }).payload;
  };

  it("subtracts 2 × level from a saving-throw total", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "exhaustion",
      level: 2,
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:hero",
      ability: "con",
      dc: 1,
    });
    const p = savePayload(r);
    // con mod +2, exhaustion-2 penalty −4 ⇒ total = natural − 2.
    expect(p.total).toBe((p.natural ?? 0) + 2 - 4);
  });

  it("subtracts 2 × level from an ability-check total", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "exhaustion",
      level: 3,
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:hero",
      ability: "str",
    });
    const p = checkPayload(r);
    // str mod +2, exhaustion-3 penalty −6 ⇒ total = natural − 4.
    expect(p.total).toBe((p.natural ?? 0) + 2 - 6);
  });

  it("reduces Speed by 5 ft per level (not halved)", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "exhaustion",
      level: 4,
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      sceneId: "s:1",
      combatants: ["pc:hero", "npc:foe"],
      sides: { "pc:hero": "party", "npc:foe": "foes" },
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    const hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"];
    // 30 − 5×4 = 10 ft of movement on a fresh turn.
    expect(hero?.actionEconomy?.movement.total).toBe(10);
  });
});

describe("Frightened (SRD 5.2.1)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 8 });
    await setup(engine);
  });

  const checkPayload = (r: Awaited<ReturnType<Engine["execute"]>>) => {
    if (!r.accepted) throw new Error("check rejected");
    const e = r.events.find((ev) => ev.type === "CheckRolled");
    return (e as { payload: CheckRolledPayload }).payload;
  };

  it("gives disadvantage on ability checks while the fear source is visible", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "frightened",
      source: "npc:foe",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:hero",
      ability: "wis",
    });
    expect(checkPayload(r).mode).toBe("disadvantage");
  });

  it("blocks moving closer to the fear source but allows retreating", async () => {
    // hero at (0,0); foe (fear source) at (3,0).
    await engine.execute(CAMPAIGN, {
      type: "relocate_entity",
      entity: "npc:foe",
      sceneId: "s:1",
      position: { x: 3, y: 0 },
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "frightened",
      source: "npc:foe",
    });
    const closer = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 1, y: 0 },
    });
    expect(closer.accepted).toBe(false);
    if (!closer.accepted) expect(closer.reason.code).toBe("FRIGHTENED");

    const away = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 1 },
    });
    expect(away.accepted).toBe(true);
  });
});

describe("Conditions: determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 9 });
    await setup(engine);
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:foe",
      condition: "restrained",
    });
    await attack(engine);
    await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "npc:foe",
      ability: "dex",
      dc: 12,
    });
    return engine;
  };

  it("rebuilding from the log reproduces the projection", async () => {
    const engine = await run();
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);
    const { rebuild } = await import("./projections/world-state");
    expect(rebuild(CAMPAIGN, events)).toEqual(live);
  });
});
