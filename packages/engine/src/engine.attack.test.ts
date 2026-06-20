import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";
import type { AttackResolvedPayload } from "./events/types";

const ABILITIES: AbilityScores = {
  str: 16,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:attack";

async function setup(engine: Engine, targetAc: number, targetHp = 100_000) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Arena" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:fighter",
      kind: "character",
      name: "Fighter",
      abilityScores: ABILITIES,
      maxHp: 30,
      baseAc: 16,
      sceneId: "s:1",
    },
  });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "npc:dummy",
      kind: "monster",
      name: "Training Dummy",
      abilityScores: ABILITIES,
      maxHp: targetHp,
      baseAc: targetAc,
      sceneId: "s:1",
    },
  });
}

describe("Combat: attack & damage pipeline", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 100 });
  });

  it("applies damage through the HP path on a guaranteed hit", async () => {
    await setup(engine, /* AC */ 1, /* HP */ 30);
    const result = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:fighter",
      target: "npc:dummy",
      attackBonus: 5,
      damage: { notation: "1d8+3", type: "slashing" },
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      const attack = result.events.find((e) => e.type === "AttackResolved");
      const dealt = result.events.find((e) => e.type === "DamageDealt");
      expect(attack).toBeDefined();
      expect(dealt).toBeDefined();
      const payload = (attack as { payload: AttackResolvedPayload }).payload;
      expect(payload.hit).toBe(true);
      const state = await engine.getState(CAMPAIGN);
      expect(state.entities["npc:dummy"]?.hp.current).toBe(30 - payload.damage!);
    }
  });

  it("rejects an attack from a missing attacker / on a missing target", async () => {
    await setup(engine, 15);
    const noAttacker = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:ghost",
      target: "npc:dummy",
      attackBonus: 5,
      damage: { notation: "1d6", type: "piercing" },
    });
    expect(noAttacker.accepted).toBe(false);
    if (!noAttacker.accepted) {
      expect(noAttacker.reason.code).toBe("ACTOR_NOT_FOUND");
    }
    const noTarget = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:fighter",
      target: "npc:ghost",
      attackBonus: 5,
      damage: { notation: "1d6", type: "piercing" },
    });
    expect(noTarget.accepted).toBe(false);
    if (!noTarget.accepted) {
      expect(noTarget.reason.code).toBe("TARGET_NOT_FOUND");
    }
  });

  it("covers hit, miss, and crit deterministically over a fixed seed", async () => {
    // AC 10, +0 to-hit against an unkillable dummy: the seeded d20 stream yields
    // a deterministic mix of misses (nat < 10 or nat 1), normal hits, and crits
    // (nat 20). Categorise the whole batch and assert every invariant.
    await setup(engine, /* AC */ 10);

    const payloads: AttackResolvedPayload[] = [];
    const dealtCounts: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      const result = await engine.execute(CAMPAIGN, {
        type: "attack",
        attacker: "pc:fighter",
        target: "npc:dummy",
        attackBonus: 0,
        damage: { notation: "1d8+3", type: "slashing" },
      });
      if (result.accepted) {
        const attack = result.events.find((e) => e.type === "AttackResolved");
        payloads.push((attack as { payload: AttackResolvedPayload }).payload);
        dealtCounts.push(
          result.events.filter((e) => e.type === "DamageDealt").length,
        );
      }
    }

    const crits = payloads.filter((p) => p.critical);
    const normalHits = payloads.filter((p) => p.hit && !p.critical);
    const misses = payloads.filter((p) => !p.hit);

    expect(crits.length).toBeGreaterThan(0);
    expect(normalHits.length).toBeGreaterThan(0);
    expect(misses.length).toBeGreaterThan(0);

    // Natural 20 always crits + hits; natural 1 always misses.
    for (const p of payloads) {
      if (p.attackRoll.natural === 20) {
        expect(p.hit && p.critical).toBe(true);
      }
      if (p.attackRoll.natural === 1) {
        expect(p.hit).toBe(false);
      }
    }

    // A hit emits exactly one DamageDealt with positive damage; a miss emits none.
    payloads.forEach((p, i) => {
      if (p.hit) {
        expect(dealtCounts[i]).toBe(1);
        expect(p.damage!).toBeGreaterThan(0);
      } else {
        expect(dealtCounts[i]).toBe(0);
        expect(p.damage).toBeUndefined();
      }
    });

    // Crit damage uses doubled dice (2d8+3 → min 5), so it clears the 1d8+3 floor.
    for (const p of crits) {
      expect(p.damage!).toBeGreaterThanOrEqual(5);
    }
  });

  it("honours advantage by widening the hit rate vs disadvantage on the same seed", async () => {
    const hitRate = async (mode: "advantage" | "disadvantage") => {
      const e = new Engine({ now: () => 1 });
      await setup(e, /* AC */ 15);
      let hits = 0;
      for (let i = 0; i < 200; i += 1) {
        const r = await e.execute(CAMPAIGN, {
          type: "attack",
          attacker: "pc:fighter",
          target: "npc:dummy",
          attackBonus: 0,
          damage: { notation: "1d8", type: "slashing" },
          mode,
        });
        if (r.accepted && r.summary.hit) hits += 1;
      }
      return hits;
    };
    expect(await hitRate("advantage")).toBeGreaterThan(await hitRate("disadvantage"));
  });
});

describe("Combat: attack determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 7 });
    await setup(engine, 14, 200);
    for (let i = 0; i < 5; i += 1) {
      await engine.execute(CAMPAIGN, {
        type: "attack",
        attacker: "pc:fighter",
        target: "npc:dummy",
        attackBonus: 4,
        damage: { notation: "1d10+2", type: "piercing" },
      });
    }
    return engine;
  };

  it("two identical attack streams converge", async () => {
    expect(await (await run()).getState(CAMPAIGN)).toEqual(
      await (await run()).getState(CAMPAIGN),
    );
  });

  it("rebuilding from the log reproduces the projection", async () => {
    const engine = await run();
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);
    const { rebuild } = await import("./projections/world-state");
    expect(rebuild(CAMPAIGN, events)).toEqual(live);
  });
});
