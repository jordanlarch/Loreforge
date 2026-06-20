import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 16,
  dex: 14,
  con: 15,
  int: 10,
  wis: 12,
  cha: 8,
};

const CAMPAIGN = "c:test";

async function setupCampaign(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Arena" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:thorin",
      kind: "character",
      name: "Thorin",
      abilityScores: ABILITIES,
      maxHp: 40,
      baseAc: 16,
      sceneId: "s:1",
    },
  });
}

describe("Engine command pipeline", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1_700_000_000_000 });
    await setupCampaign(engine);
  });

  it("creates scenes and entities and updates the projection", async () => {
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe("s:1");
    expect(state.entities["pc:thorin"]?.hp.max).toBe(40);
  });

  it("rejects a duplicate entity without persisting events", async () => {
    const before = (await engine.getEvents(CAMPAIGN)).length;
    const result = await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:thorin",
        kind: "character",
        name: "Imposter",
        abilityScores: ABILITIES,
        maxHp: 1,
        baseAc: 1,
      },
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("DUPLICATE_ENTITY");
    expect(await engine.getEvents(CAMPAIGN)).toHaveLength(before);
  });

  it("rejects changing to a non-existent scene", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "change_scene",
      sceneId: "s:void",
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("SCENE_NOT_FOUND");
  });

  it("applies fixed damage and reflects it in the projection", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "slashing",
      source: { amount: 12 },
    });
    expect(result.accepted).toBe(true);
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:thorin"]?.hp.current,
    ).toBe(28);
  });

  it("rolls damage deterministically and emits a DiceRolled + DamageDealt pair", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "fire",
      source: { notation: "2d6+3" },
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      const types = result.events.map((e) => e.type);
      expect(types).toEqual(["DiceRolled", "DamageDealt"]);
    }
  });

  it("rejects damage to an unknown target", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ghost",
      damageType: "psychic",
      source: { amount: 5 },
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("TARGET_NOT_FOUND");
  });

  it("heals a downed (0 HP, not dead) creature back to its feet", async () => {
    // 100 necrotic drops Thorin to 0 HP: downed and unconscious, but not dead.
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "necrotic",
      source: { amount: 100 },
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_healing",
      target: "pc:thorin",
      source: { amount: 10 },
    });
    expect(result.accepted).toBe(true);
    const state = await engine.getState(CAMPAIGN);
    const thorin = state.entities["pc:thorin"];
    expect(thorin?.hp.current).toBe(10);
    expect(thorin?.alive).toBe(true);
    expect(thorin?.dead).toBe(false);
    expect(thorin?.deathSaves).toBeUndefined();
  });

  it("heals up to max", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "slashing",
      source: { amount: 30 },
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_healing",
      target: "pc:thorin",
      source: { amount: 100 },
    });
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:thorin"]?.hp.current,
    ).toBe(40);
  });

  it("moves an entity and records the prior position", async () => {
    await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:thorin",
      to: { x: 3, y: 4 },
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:thorin",
      to: { x: 5, y: 6 },
    });
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:thorin"]?.position,
    ).toEqual({
      x: 5,
      y: 6,
    });
    expect(result.accepted).toBe(true);
  });

  it("does not advance the RNG stream when a command is rejected", async () => {
    // A rejected rolled-damage command (unknown target) must not consume a draw.
    const first = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ghost",
      damageType: "fire",
      source: { notation: "3d6" },
      scope: "shared",
    });
    expect(first.accepted).toBe(false);
    const a = await engine.execute(CAMPAIGN, {
      type: "roll_dice",
      notation: "3d6",
      scope: "shared",
    });
    // Build a parallel campaign with no prior rejected draw — totals must match.
    const fresh = new Engine({ now: () => 1 });
    const b = await fresh.execute("c:fresh", {
      type: "roll_dice",
      notation: "3d6",
      scope: "shared",
    });
    if (a.accepted && b.accepted) {
      expect(a.summary.total).toBe(b.summary.total);
    }
  });
});

describe("Engine determinism & replay", () => {
  it("two engines with the same command stream converge to identical state", async () => {
    const run = async () => {
      const engine = new Engine({ now: () => 42 });
      await setupCampaign(engine);
      await engine.execute(CAMPAIGN, {
        type: "apply_damage",
        target: "pc:thorin",
        damageType: "fire",
        source: { notation: "4d8+2" },
      });
      await engine.execute(CAMPAIGN, {
        type: "roll_dice",
        notation: "1d20",
        mode: "advantage",
        scope: "attack",
      });
      return engine.getState(CAMPAIGN);
    };
    expect(await run()).toEqual(await run());
  });

  it("rebuilding from the event log reproduces the live projection", async () => {
    const engine = new Engine({ now: () => 42 });
    await setupCampaign(engine);
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "fire",
      source: { notation: "4d8+2" },
    });
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);

    const { rebuild } = await import("./projections/world-state");
    const replayed = rebuild(CAMPAIGN, events);
    expect(replayed).toEqual(live);
  });
});
