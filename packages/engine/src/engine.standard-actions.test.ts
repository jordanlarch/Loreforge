import { beforeEach, describe, expect, it } from "vitest";

import { attacksAgainstHaveDisadvantage } from "./combat/effects";
import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";
import type { AttackResolvedPayload } from "./events/types";

const ABILITIES: AbilityScores = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:standard";

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

async function startSoloTurn(engine: Engine, id: string) {
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    combatants: [id],
  });
  await engine.execute(CAMPAIGN, { type: "roll_initiative" });
}

describe("Standard actions (SRD-FID-14)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
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
    await startSoloTurn(engine, "pc:hero");
  });

  it("Dash doubles remaining movement for the turn", async () => {
    const dash = await engine.execute(CAMPAIGN, { type: "dash", entity: "pc:hero" });
    expect(dash.accepted).toBe(true);
    const hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"];
    expect(hero?.actionEconomy?.movement.total).toBe(60);
    expect(hero?.actionEconomy?.action).toBe("used");
  });

  it("Disengage prevents leaving reach from opening an OA window", async () => {
    await place(engine, "npc:foe", { x: 1, y: 0 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero", "npc:foe"],
      sides: { "pc:hero": "party", "npc:foe": "enemies" },
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    await engine.execute(CAMPAIGN, { type: "disengage", entity: "pc:hero" });
    const move = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:hero",
      to: { x: 0, y: 2 },
    });
    expect(move.accepted).toBe(true);
    if (move.accepted) {
      expect(move.events.find((e) => e.type === "ReactionWindowOpened")).toBeUndefined();
    }
    expect((await engine.getState(CAMPAIGN)).entities["pc:hero"]?.disengaged).toBe(true);
  });

  it("Dodge imposes disadvantage on attacks against the dodger", async () => {
    await engine.execute(CAMPAIGN, { type: "dodge", entity: "pc:hero" });
    const hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"]!;
    expect(hero.dodging).toBe(true);
    expect(attacksAgainstHaveDisadvantage(hero)).toBe(true);
  });

  it("Help (attack) grants an effect consumed on the helped attack", async () => {
    await place(engine, "pc:ally", { x: 0, y: 1 });
    await place(engine, "npc:foe", { x: 1, y: 0 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:hero", "pc:ally", "npc:foe"],
      sides: {
        "pc:hero": "party",
        "pc:ally": "party",
        "npc:foe": "enemies",
      },
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    const help = await engine.execute(CAMPAIGN, {
      type: "help",
      helper: "pc:hero",
      beneficiary: "pc:ally",
      mode: "attack",
      foe: "npc:foe",
    });
    expect(help.accepted).toBe(true);
    const allyBefore = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(allyBefore.effects?.some((fx) => fx.modifier.type === "help_attack")).toBe(
      true,
    );
    await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:ally",
      target: "npc:foe",
      attackBonus: 5,
      damage: { notation: "1d4", type: "piercing" },
    });
    const allyAfter = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(allyAfter.effects?.some((fx) => fx.modifier.type === "help_attack")).toBe(
      false,
    );
  });

  it("Hide on a passing Stealth check applies Invisible", async () => {
    const hide = await engine.execute(CAMPAIGN, {
      type: "hide",
      entity: "pc:hero",
      dc: 1,
      proficient: true,
    });
    expect(hide.accepted).toBe(true);
    if (hide.accepted) expect(hide.summary?.hidden).toBe(true);
    const hero = (await engine.getState(CAMPAIGN)).entities["pc:hero"]!;
    expect(hero.conditions.some((c) => c.condition === "invisible")).toBe(true);
  });
});

describe("Cover (SRD-FID-15)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 2 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:map",
        name: "Lane",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:map" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:archer",
        kind: "character",
        name: "Archer",
        abilityScores: ABILITIES,
        maxHp: 20,
        baseAc: 12,
        sceneId: "s:map",
        position: { x: 0, y: 0 },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:cover",
        kind: "monster",
        name: "Pillar",
        abilityScores: ABILITIES,
        maxHp: 20,
        baseAc: 12,
        sceneId: "s:map",
        position: { x: 1, y: 0 },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:target",
        kind: "monster",
        name: "Target",
        abilityScores: ABILITIES,
        maxHp: 20,
        baseAc: 10,
        sceneId: "s:map",
        position: { x: 2, y: 0 },
      },
    });
  });

  it("adds +2 AC for half cover from an intervening creature", async () => {
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:archer",
      target: "npc:target",
      attackBonus: 0,
      damage: { notation: "1d4", type: "piercing" },
      rangeFt: 30,
    });
    expect(attack.accepted).toBe(true);
    const resolved = attack.accepted
      ? (attack.events.find((e) => e.type === "AttackResolved") as {
          payload: AttackResolvedPayload;
        })
      : undefined;
    expect(resolved?.payload.targetAc).toBe(12);
  });
});
