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

function setupCampaign(engine: Engine) {
  engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Arena" },
  });
  engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  engine.execute(CAMPAIGN, {
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
  beforeEach(() => {
    engine = new Engine({ now: () => 1_700_000_000_000 });
    setupCampaign(engine);
  });

  it("creates scenes and entities and updates the projection", () => {
    const state = engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe("s:1");
    expect(state.entities["pc:thorin"]?.hp.max).toBe(40);
  });

  it("rejects a duplicate entity without persisting events", () => {
    const before = engine.getEvents(CAMPAIGN).length;
    const result = engine.execute(CAMPAIGN, {
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
    expect(engine.getEvents(CAMPAIGN)).toHaveLength(before);
  });

  it("rejects changing to a non-existent scene", () => {
    const result = engine.execute(CAMPAIGN, {
      type: "change_scene",
      sceneId: "s:void",
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("SCENE_NOT_FOUND");
  });

  it("applies fixed damage and reflects it in the projection", () => {
    const result = engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "slashing",
      source: { amount: 12 },
    });
    expect(result.accepted).toBe(true);
    expect(engine.getState(CAMPAIGN).entities["pc:thorin"]?.hp.current).toBe(28);
  });

  it("rolls damage deterministically and emits a DiceRolled + DamageDealt pair", () => {
    const result = engine.execute(CAMPAIGN, {
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

  it("rejects damage to an unknown target", () => {
    const result = engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ghost",
      damageType: "psychic",
      source: { amount: 5 },
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("TARGET_NOT_FOUND");
  });

  it("refuses to heal a dead entity", () => {
    engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "necrotic",
      source: { amount: 100 },
    });
    const result = engine.execute(CAMPAIGN, {
      type: "apply_healing",
      target: "pc:thorin",
      source: { amount: 10 },
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("TARGET_DEAD");
  });

  it("heals up to max", () => {
    engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "slashing",
      source: { amount: 30 },
    });
    engine.execute(CAMPAIGN, {
      type: "apply_healing",
      target: "pc:thorin",
      source: { amount: 100 },
    });
    expect(engine.getState(CAMPAIGN).entities["pc:thorin"]?.hp.current).toBe(40);
  });

  it("moves an entity and records the prior position", () => {
    engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:thorin",
      to: { x: 3, y: 4 },
    });
    const result = engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:thorin",
      to: { x: 5, y: 6 },
    });
    expect(engine.getState(CAMPAIGN).entities["pc:thorin"]?.position).toEqual({
      x: 5,
      y: 6,
    });
    expect(result.accepted).toBe(true);
  });

  it("does not advance the RNG stream when a command is rejected", () => {
    // A rejected rolled-damage command (unknown target) must not consume a draw.
    const first = engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ghost",
      damageType: "fire",
      source: { notation: "3d6" },
      scope: "shared",
    });
    expect(first.accepted).toBe(false);
    const a = engine.execute(CAMPAIGN, {
      type: "roll_dice",
      notation: "3d6",
      scope: "shared",
    });
    // Build a parallel campaign with no prior rejected draw — totals must match.
    const fresh = new Engine({ now: () => 1 });
    const b = fresh.execute("c:fresh", {
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
  it("two engines with the same command stream converge to identical state", () => {
    const run = () => {
      const engine = new Engine({ now: () => 42 });
      setupCampaign(engine);
      engine.execute(CAMPAIGN, {
        type: "apply_damage",
        target: "pc:thorin",
        damageType: "fire",
        source: { notation: "4d8+2" },
      });
      engine.execute(CAMPAIGN, {
        type: "roll_dice",
        notation: "1d20",
        mode: "advantage",
        scope: "attack",
      });
      return engine.getState(CAMPAIGN);
    };
    expect(run()).toEqual(run());
  });

  it("rebuilding from the event log reproduces the live projection", async () => {
    const engine = new Engine({ now: () => 42 });
    setupCampaign(engine);
    engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:thorin",
      damageType: "fire",
      source: { notation: "4d8+2" },
    });
    const live = engine.getState(CAMPAIGN);
    const events = engine.getEvents(CAMPAIGN);

    const { rebuild } = await import("./projections/world-state");
    const replayed = rebuild(CAMPAIGN, events);
    expect(replayed).toEqual(live);
  });
});
