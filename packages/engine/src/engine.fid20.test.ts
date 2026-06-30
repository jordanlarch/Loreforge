import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";
import type { CheckRolledPayload } from "./events/types";

const CAMPAIGN = "c:fid20";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

async function setupScene(
  engine: Engine,
  opts: { blockedCells?: GridPosition[] } = {},
) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:arena",
      name: "Arena",
      map: {
        width: 10,
        height: 10,
        blockedCells: opts.blockedCells ?? [],
      },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
}

async function place(
  engine: Engine,
  id: string,
  position: GridPosition,
  abilityScores: AbilityScores = ABILITIES,
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores,
      maxHp: 40,
      baseAc: 12,
      speed: 30,
      sceneId: "s:arena",
      position,
    },
  });
}

function checkPayload(
  r: Awaited<ReturnType<Engine["execute"]>>,
): CheckRolledPayload {
  if (!r.accepted) throw new Error("command rejected");
  const e = r.events.find((ev) => ev.type === "CheckRolled");
  return (e as { payload: CheckRolledPayload }).payload;
}

describe("SRD-FID-20: blinded / deafened auto-fail", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:scout", { x: 0, y: 0 });
  });

  it("auto-fails Perception while blinded", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:scout",
      condition: "blinded",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:scout",
      ability: "wis",
      skill: "Perception",
      dc: 5,
    });
    const check = checkPayload(r);
    expect(check.autoFail).toBe(true);
    expect(check.success).toBe(false);
    expect(check.total).toBe(0);
  });

  it("auto-fails hearing checks while deafened", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:scout",
      condition: "deafened",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:scout",
      ability: "wis",
      skill: "Insight",
      dc: 5,
      requiresHearing: true,
    });
    const check = checkPayload(r);
    expect(check.autoFail).toBe(true);
    expect(check.success).toBe(false);
  });
});

describe("SRD-FID-20: frightened line-of-sight gates", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 2 });
    await setupScene(engine, { blockedCells: [{ x: 1, y: 0 }] });
    await place(engine, "pc:hero", { x: 0, y: 0 });
    await place(engine, "npc:dragon", { x: 3, y: 0 });
  });

  it("applies check disadvantage only while the fear source is visible", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "frightened",
      source: "npc:dragon",
    });
    const blocked = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:hero",
      ability: "wis",
    });
    expect(checkPayload(blocked).mode).toBe("normal");

    await engine.execute(CAMPAIGN, {
      type: "relocate_entity",
      entity: "npc:dragon",
      sceneId: "s:arena",
      position: { x: 0, y: 1 },
    });
    const visible = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:hero",
      ability: "wis",
    });
    expect(checkPayload(visible).mode).toBe("disadvantage");
  });
});

describe("SRD-FID-20: escape grapple", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 3 });
    await setupScene(engine);
    await place(engine, "pc:hero", { x: 0, y: 0 }, {
      ...ABILITIES,
      str: 20,
      dex: 14,
    });
    await place(engine, "npc:brute", { x: 1, y: 0 }, {
      ...ABILITIES,
      str: 8,
      dex: 8,
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero", "npc:brute"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "grappled",
      source: "npc:brute",
    });
  });

  it("rejects escape when not grappled", async () => {
    await engine.execute(CAMPAIGN, {
      type: "remove_condition",
      target: "pc:hero",
      condition: "grappled",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "escape_grapple",
      entity: "pc:hero",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NOT_GRAPPLED");
  });

  it("removes grappled on a successful escape check", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "escape_grapple",
      entity: "pc:hero",
    });
    expect(r.accepted).toBe(true);
    if (r.accepted) expect(r.summary?.success).toBe(true);
    const hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"]!;
    expect(hero.conditions.some((c) => c.condition === "grappled")).toBe(false);
    expect(hero.actionEconomy?.action).toBe("used");
  });
});

describe("SRD-FID-20: petrified damage resistance", () => {
  it("halves incoming damage via apply_damage", async () => {
    const engine = new Engine({ now: () => 4 });
    await setupScene(engine);
    await place(engine, "npc:statue", { x: 0, y: 0 });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:statue",
      condition: "petrified",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "npc:statue",
      damageType: "slashing",
      source: { amount: 11 },
    });
    expect(r.accepted).toBe(true);
    const target = (await engine.getState(CAMPAIGN)).entities["npc:statue"];
    expect(target?.hp.current).toBe(35);
  });
});
