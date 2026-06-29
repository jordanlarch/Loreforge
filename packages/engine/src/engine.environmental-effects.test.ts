import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const LOW_DEX: AbilityScores = {
  str: 10,
  dex: 6,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:env";

describe("Gameplay Toolbox environmental effects (GRILL-LIVE-ENV-EFFECT)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function createPair(dex: AbilityScores = ABILITIES) {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:arena", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:hero",
        kind: "character",
        name: "Hero",
        abilityScores: dex,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
  }

  it("set_scene_environmental_effects stores slugs on scene", async () => {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:cold", name: "Cold Room" },
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "set_scene_environmental_effects",
      sceneId: "s:cold",
      slugs: ["srd-2024_extreme-cold", "srd-2024_slippery-ice"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const state = await engine.getState(CAMPAIGN);
    expect(state.scenes["s:cold"]?.environmentalEffectSlugs).toEqual([
      "srd-2024_extreme-cold",
      "srd-2024_slippery-ice",
    ]);
  });

  it("apply_environmental_effect rolls an initial save", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_environmental_effect",
      target: "pc:hero",
      effectSlug: "srd-2024_slippery-ice",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
  });

  it("slippery ice applies prone and tracks instance on failed save", async () => {
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:si:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: LOW_DEX,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const result = await trial.execute(campaign, {
        type: "apply_environmental_effect",
        target: "pc:hero",
        effectSlug: "srd-2024_slippery-ice",
      });
      if (!result.accepted) continue;
      const applied = result.events.find((e) => e.type === "EnvironmentalEffectApplied");
      if (!applied || applied.type !== "EnvironmentalEffectApplied") continue;
      const prone = result.events.some(
        (e) =>
          e.type === "ConditionApplied" &&
          (e.payload as { condition: string }).condition === "prone",
      );
      if (!prone) continue;

      instanceId = (applied.payload as { instanceId: string }).instanceId;
      expect((applied.payload as { pendingRepeat: boolean }).pendingRepeat).toBe(true);
      engine = trial;
      break;
    }

    expect(instanceId).toBeDefined();
  });

  it("extreme cold tracks instance without turn-start repeat (hourly deferred)", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_environmental_effect",
      target: "pc:hero",
      effectSlug: "srd-2024_extreme-cold",
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const applied = result.events.find((e) => e.type === "EnvironmentalEffectApplied");
    expect(applied).toBeDefined();
    if (!applied || applied.type !== "EnvironmentalEffectApplied") return;
    expect((applied.payload as { pendingRepeat: boolean }).pendingRepeat).toBe(false);

    const state = await engine.getState(CAMPAIGN);
    expect(
      state.entities["pc:hero"]?.activeEnvironmentalEffects?.some(
        (i) => i.effectSlug === "srd-2024_extreme-cold",
      ),
    ).toBe(true);
  });

  it("remove_environmental_effect clears instance and prone", async () => {
    let campaign = CAMPAIGN;
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      campaign = `${CAMPAIGN}:rm:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: LOW_DEX,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const apply = await trial.execute(campaign, {
        type: "apply_environmental_effect",
        target: "pc:hero",
        effectSlug: "srd-2024_slippery-ice",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "EnvironmentalEffectApplied");
      if (!applied || applied.type !== "EnvironmentalEffectApplied") continue;

      instanceId = (applied.payload as { instanceId: string }).instanceId;
      engine = trial;
      break;
    }

    expect(instanceId).toBeDefined();
    if (!instanceId) return;

    const removed = await engine.execute(campaign, {
      type: "remove_environmental_effect",
      target: "pc:hero",
      instanceId,
    });
    expect(removed.accepted).toBe(true);
    if (!removed.accepted) return;

    const after = await engine.getState(campaign);
    expect(after.entities["pc:hero"]?.activeEnvironmentalEffects?.length ?? 0).toBe(0);
    expect(
      after.entities["pc:hero"]?.conditions?.some((c) => c.condition === "prone"),
    ).toBe(false);
  });

  it("rejects duplicate slug on apply_environmental_effect (Q2 dedupe)", async () => {
    await createPair();
    let campaign = CAMPAIGN;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => seed });
      campaign = `${CAMPAIGN}:dup:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: LOW_DEX,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const first = await trial.execute(campaign, {
        type: "apply_environmental_effect",
        target: "pc:hero",
        effectSlug: "srd-2024_slippery-ice",
      });
      if (!first.accepted) continue;
      if (!first.events.some((e) => e.type === "EnvironmentalEffectApplied")) continue;

      engine = trial;
      break;
    }

    const duplicate = await engine.execute(campaign, {
      type: "apply_environmental_effect",
      target: "pc:hero",
      effectSlug: "srd-2024_slippery-ice",
    });
    expect(duplicate.accepted).toBe(false);
    if (duplicate.accepted) return;
    expect(duplicate.reason.code).toBe("ENVIRONMENTAL_EFFECT_ALREADY_ACTIVE");
  });

  it("change_scene removes ambient instances for departing scene slugs", async () => {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:cold", name: "Cold" },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:warm", name: "Warm" },
    });
    await engine.execute(CAMPAIGN, {
      type: "set_scene_environmental_effects",
      sceneId: "s:cold",
      slugs: ["srd-2024_extreme-cold"],
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:cold" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:hero",
        kind: "character",
        name: "Hero",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:cold",
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_environmental_effect",
      target: "pc:hero",
      effectSlug: "srd-2024_extreme-cold",
    });

    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:warm" });

    const after = await engine.getState(CAMPAIGN);
    expect(after.entities["pc:hero"]?.activeEnvironmentalEffects?.length ?? 0).toBe(0);
  });

  it("slippery ice resolves repeat tick at turn start in combat", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:tick:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: LOW_DEX,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "npc:foe",
          kind: "npc",
          name: "Foe",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const apply = await trial.execute(campaign, {
        type: "apply_environmental_effect",
        target: "pc:hero",
        effectSlug: "srd-2024_slippery-ice",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "EnvironmentalEffectApplied");
      if (!applied || !(applied.payload as { pendingRepeat?: boolean }).pendingRepeat) {
        continue;
      }

      await trial.execute(campaign, {
        type: "start_encounter",
        sceneId: "s:arena",
        combatants: ["pc:hero", "npc:foe"],
      });
      await trial.execute(campaign, { type: "roll_initiative", bonuses: {} });

      const state = await trial.getState(campaign);
      const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
      if (active !== "pc:hero") {
        await trial.execute(campaign, { type: "end_turn" });
      }

      const tickEvents = (await trial.getEvents(campaign)).filter(
        (e) => e.type === "EnvironmentalEffectTickResolved",
      );
      expect(tickEvents.length).toBeGreaterThan(0);
      found = true;
    }

    expect(found).toBe(true);
  });

  it("rejects unknown environmental effect slug", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_environmental_effect",
      target: "pc:hero",
      effectSlug: "srd-2024_unknown-effect",
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("ENVIRONMENTAL_EFFECT_NOT_FOUND");
  });
});
