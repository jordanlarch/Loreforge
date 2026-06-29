import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import { BURNING_SLUG } from "./content/srd-exploration-hazard-seeds";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const HIGH_DEX: AbilityScores = {
  str: 10,
  dex: 20,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:exploration-hazards";

describe("Exploration hazards (GRILL-EXPLORATION Slice 2)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function createHero(dex: AbilityScores = ABILITIES) {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:cliff", name: "Cliff" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:cliff" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:hero",
        kind: "character",
        name: "Hero",
        abilityScores: dex,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:cliff",
      },
    });
  }

  async function createPair() {
    await createHero();
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:foe",
        kind: "npc",
        name: "Foe",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:cliff",
      },
    });
  }

  async function startCombat(activeFirst: "pc:hero" | "npc:foe" = "pc:hero") {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      sceneId: "s:cliff",
      combatants: ["pc:hero", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative", bonuses: {} });
    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
    if (active !== activeFirst) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
    }
  }

  it("apply_fall_damage rolls bludgeoning and applies prone when damage > 0", async () => {
    await createHero();

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:fall:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:cliff", name: "Cliff" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:cliff" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:cliff",
        },
      });

      const result = await trial.execute(campaign, {
        type: "apply_fall_damage",
        target: "pc:hero",
        heightFt: 30,
      });
      if (!result.accepted) continue;
      if (!result.events.some((e) => e.type === "DiceRolled")) continue;
      if (typeof result.summary.damage !== "number" || result.summary.damage <= 0) {
        continue;
      }

      expect(result.events.some((e) => e.type === "DamageDealt")).toBe(true);
      expect(result.events.some((e) => e.type === "ConditionApplied")).toBe(true);
      return;
    }

    throw new Error("Could not find a fall roll with damage > 0 in 200 seeds");
  });

  it("apply_fall_damage skips dice for falls under 10 ft", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fall_damage",
      target: "pc:hero",
      heightFt: 5,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events).toHaveLength(0);
    if ("damage" in result.summary) {
      expect(result.summary.damage).toBe(0);
    }
  });

  it("apply_fall_damage rejects negative height", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fall_damage",
      target: "pc:hero",
      heightFt: -1,
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("INVALID_PAYLOAD");
  });

  it("apply_burning tracks activeBurning on entity", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
      burningSlug: BURNING_SLUG,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "BurningApplied")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:hero"]?.activeBurning?.length).toBe(1);
    expect(state.entities["pc:hero"]?.activeBurning?.[0]?.burningSlug).toBe(
      BURNING_SLUG,
    );
  });

  it("rejects duplicate burning slug on apply_burning", async () => {
    await createHero();
    const first = await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
    });
    expect(first.accepted).toBe(true);

    const second = await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
    });

    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason.code).toBe("BURNING_ALREADY_ACTIVE");
  });

  it("extinguish_burning with action removes instance", async () => {
    await createHero();
    const applied = await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
    });
    expect(applied.accepted).toBe(true);
    if (!applied.accepted) return;

    const instanceId = applied.summary.instanceId as string;
    const result = await engine.execute(CAMPAIGN, {
      type: "extinguish_burning",
      target: "pc:hero",
      instanceId,
      method: "action",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "BurningRemoved")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:hero"]?.activeBurning?.length ?? 0).toBe(0);
  });

  it("extinguish_burning dex_save removes instance on successful save", async () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:ext:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:cliff", name: "Cliff" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:cliff" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: HIGH_DEX,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:cliff",
        },
      });

      const applied = await trial.execute(campaign, {
        type: "apply_burning",
        target: "pc:hero",
      });
      if (!applied.accepted) continue;

      const instanceId = applied.summary.instanceId as string;
      const result = await trial.execute(campaign, {
        type: "extinguish_burning",
        target: "pc:hero",
        instanceId,
        method: "dex_save",
      });
      if (!result.accepted) continue;
      if (!result.events.some((e) => e.type === "BurningRemoved")) continue;

      expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
      const state = await trial.getState(campaign);
      expect(state.entities["pc:hero"]?.activeBurning?.length ?? 0).toBe(0);
      return;
    }

    throw new Error("Could not find a successful dex extinguish in 200 seeds");
  });

  it("resolve_burning_tick deals fire damage at turn start in combat", async () => {
    await createPair();
    await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
    });

    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      sceneId: "s:cliff",
      combatants: ["pc:hero", "npc:foe"],
    });
    const roll = await engine.execute(CAMPAIGN, { type: "roll_initiative", bonuses: {} });
    expect(roll.accepted).toBe(true);
    if (!roll.accepted) return;

    let events = roll.events;
    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
    if (active !== "pc:hero") {
      const end = await engine.execute(CAMPAIGN, { type: "end_turn" });
      expect(end.accepted).toBe(true);
      if (!end.accepted) return;
      events = end.events;
    }

    const tick = events.some((e) => e.type === "BurningTickResolved");
    const fire = events.some((e) => e.type === "DamageDealt");
    expect(tick || fire).toBe(true);
  });

  it("burning tick fires again after end_turn when hero remains active", async () => {
    await createPair();
    await engine.execute(CAMPAIGN, {
      type: "apply_burning",
      target: "pc:hero",
    });
    await startCombat("pc:hero");

    const end = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(end.accepted).toBe(true);
    if (!end.accepted) return;

    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
    if (active === "pc:hero") {
      expect(end.events.some((e) => e.type === "BurningTickResolved")).toBe(true);
    }
  });
});
