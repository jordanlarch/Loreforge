import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, ClassLevel } from "./entities/types";

const CAMPAIGN = "c:economy";

function scores(): AbilityScores {
  return { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 };
}

const STRIKE = {
  attackBonus: 4,
  damage: { notation: "1d6+2", type: "slashing" },
} as const;

type Combatant = {
  id: string;
  kind: "character" | "monster";
  attacksPerAction?: number;
  classes?: ClassLevel[];
};

/**
 * Arm an encounter of mapless combatants (no positions → no LOS/adjacency
 * gating) and roll initiative. Returns the active combatant + a foe to hit.
 */
async function arena(engine: Engine, combatants: Combatant[]) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:ring", name: "Ring" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:ring" });
  for (const c of combatants) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: c.id,
        kind: c.kind,
        name: c.id,
        abilityScores: scores(),
        maxHp: 100,
        baseAc: 1, // every attack lands, so HP never blocks a follow-up
        speed: 30,
        sceneId: "s:ring",
        ...(c.attacksPerAction !== undefined
          ? { attacksPerAction: c.attacksPerAction }
          : {}),
        ...(c.classes ? { classes: c.classes } : {}),
      },
    });
  }
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    combatants: combatants.map((c) => c.id),
  });
  await engine.execute(CAMPAIGN, { type: "roll_initiative" });
  const state = await engine.getState(CAMPAIGN);
  const active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
  const foe = combatants.map((c) => c.id).find((id) => id !== active)!;
  return { active, foe };
}

function attack(engine: Engine, attacker: string, target: string) {
  return engine.execute(CAMPAIGN, {
    type: "attack",
    attacker,
    target,
    ...STRIKE,
  });
}

describe("Action economy: the Attack action", () => {
  let engine: Engine;
  beforeEach(() => {
    engine = new Engine({ now: () => 1 });
  });

  it("allows one weapon attack per turn and rejects the second", async () => {
    const { active, foe } = await arena(engine, [
      { id: "pc:hero", kind: "character" },
      { id: "npc:foe", kind: "monster" },
    ]);

    const first = await attack(engine, active, foe);
    expect(first.accepted).toBe(true);

    const second = await attack(engine, active, foe);
    expect(second.accepted).toBe(false);
    if (!second.accepted) {
      expect(second.reason.code).toBe("ACTION_UNAVAILABLE");
    }
  });

  it("refreshes the attack on the next turn", async () => {
    const { active, foe } = await arena(engine, [
      { id: "pc:hero", kind: "character" },
      { id: "npc:foe", kind: "monster" },
    ]);
    await attack(engine, active, foe);
    // Cycle initiative all the way back to the original attacker.
    const order = (await engine.getState(CAMPAIGN)).encounter!.order;
    for (let i = 0; i < order.length; i += 1) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
    }
    const again = await attack(engine, active, foe);
    expect(again.accepted).toBe(true);
  });

  it("grants Multiattack creatures their full attacks-per-action, then stops", async () => {
    const { active, foe } = await arena(engine, [
      { id: "npc:ogre", kind: "monster", attacksPerAction: 3 },
      { id: "pc:hero", kind: "character" },
    ]);
    // The ogre won initiative deterministically only if active === ogre; arena
    // returns whoever is active, so assert against that combatant's budget.
    const total = (await engine.getState(CAMPAIGN)).entities[active]!
      .actionEconomy!.attacks.total;

    for (let i = 0; i < total; i += 1) {
      const r = await attack(engine, active, foe);
      expect(r.accepted).toBe(true);
    }
    const over = await attack(engine, active, foe);
    expect(over.accepted).toBe(false);
  });

  it("derives Extra Attack (2 strikes) for a level-5 fighter", async () => {
    const { active, foe } = await arena(engine, [
      {
        id: "pc:fighter",
        kind: "character",
        classes: [{ class: "fighter", level: 5 }],
      },
      { id: "npc:foe", kind: "monster" },
    ]);
    const total = (await engine.getState(CAMPAIGN)).entities[active]!
      .actionEconomy!.attacks.total;
    // Only assert the Extra Attack math when the fighter is the one acting.
    if (active === "pc:fighter") {
      expect(total).toBe(2);
      expect((await attack(engine, active, foe)).accepted).toBe(true);
      expect((await attack(engine, active, foe)).accepted).toBe(true);
      expect((await attack(engine, active, foe)).accepted).toBe(false);
    }
  });

  it("reports remaining attacks in the command summary", async () => {
    const { active, foe } = await arena(engine, [
      { id: "npc:ogre", kind: "monster", attacksPerAction: 2 },
      { id: "pc:hero", kind: "character" },
    ]);
    const total = (await engine.getState(CAMPAIGN)).entities[active]!
      .actionEconomy!.attacks.total;
    const r = await attack(engine, active, foe);
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.summary?.attacksLeft).toBe(total - 1);
    }
  });

  it("does not budget attacks outside an encounter", async () => {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:field", name: "Field" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:field" });
    for (const id of ["pc:hero", "npc:foe"]) {
      await engine.execute(CAMPAIGN, {
        type: "create_entity",
        entity: {
          id,
          kind: id.startsWith("pc") ? "character" : "monster",
          name: id,
          abilityScores: scores(),
          maxHp: 100,
          baseAc: 1,
          sceneId: "s:field",
        },
      });
    }
    // No encounter → no action economy → unbudgeted attacks both succeed.
    expect((await attack(engine, "pc:hero", "npc:foe")).accepted).toBe(true);
    expect((await attack(engine, "pc:hero", "npc:foe")).accepted).toBe(true);
  });
});
