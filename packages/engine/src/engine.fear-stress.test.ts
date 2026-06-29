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

const LOW_WIS: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 6,
  cha: 10,
};

const CAMPAIGN = "c:fear";

describe("Gameplay Toolbox fear/stress (GRILL-LIVE-FEAR)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function createHero(wis: AbilityScores = ABILITIES) {
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
        abilityScores: wis,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
  }

  it("apply_fear_stress rolls an initial save", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fear_stress",
      target: "pc:hero",
      fearStressSlug: "srd-2024_sarcophagus-apparition",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
  });

  it("sarcophagus applies frightened and tracks instance on failed save", async () => {
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:sa:${seed}`;
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
          abilityScores: LOW_WIS,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const result = await trial.execute(campaign, {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
      });
      if (!result.accepted) continue;
      const applied = result.events.find((e) => e.type === "FearStressApplied");
      if (!applied || applied.type !== "FearStressApplied") continue;
      const frightened = result.events.some(
        (e) =>
          e.type === "ConditionApplied" &&
          (e.payload as { condition: string }).condition === "frightened",
      );
      if (!frightened) continue;
      instanceId = (applied.payload as { instanceId: string }).instanceId;
      break;
    }

    expect(instanceId).toBeDefined();
  });

  it("hallucinogenic substance deals psychic damage without instance", async () => {
    await createHero(LOW_WIS);
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fear_stress",
      target: "pc:hero",
      fearStressSlug: "srd-2024_hallucinogenic-substance",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "FearStressApplied")).toBe(
      false,
    );

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:hero"]?.activeFearStress?.length ?? 0).toBe(0);
  });

  it("rejects duplicate slug on apply_fear_stress (Q2 dedupe)", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:dup:${seed}`;
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
          abilityScores: LOW_WIS,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const first = await trial.execute(campaign, {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
      });
      if (!first.accepted) continue;
      if (!first.events.some((e) => e.type === "FearStressApplied")) continue;

      const second = await trial.execute(campaign, {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
      });
      expect(second.accepted).toBe(false);
      if (second.accepted) continue;
      expect(second.reason.code).toBe("FEAR_STRESS_ALREADY_ACTIVE");
      found = true;
    }

    expect(found).toBe(true);
  });

  it("change_scene removes scene-bound fear instances", async () => {
    let applied = false;

    for (let seed = 0; seed < 200 && !applied; seed += 1) {
      const trial = new Engine({ now: () => seed + 5000 });
      const campaign = `${CAMPAIGN}:leave:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:dungeon", name: "Dungeon" },
      });
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:tavern", name: "Tavern" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:dungeon" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:hero",
          kind: "character",
          name: "Hero",
          abilityScores: LOW_WIS,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:dungeon",
        },
      });

      const result = await trial.execute(campaign, {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
        boundSceneId: "s:dungeon",
      });
      if (!result.accepted) continue;
      if (!result.events.some((e) => e.type === "FearStressApplied")) continue;

      await trial.execute(campaign, { type: "change_scene", sceneId: "s:tavern" });
      const after = await trial.getState(campaign);
      expect(after.entities["pc:hero"]?.activeFearStress?.length ?? 0).toBe(0);
      applied = true;
    }

    expect(applied).toBe(true);
  });

  it("remove_fear_stress clears instance and frightened", async () => {
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => seed + 9000 });
      const campaign = `${CAMPAIGN}:rm:${seed}`;
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
          abilityScores: LOW_WIS,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const apply = await trial.execute(campaign, {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "FearStressApplied");
      if (!applied || applied.type !== "FearStressApplied") continue;
      instanceId = (applied.payload as { instanceId: string }).instanceId;
      if (!instanceId) continue;

      const removed = await trial.execute(campaign, {
        type: "remove_fear_stress",
        target: "pc:hero",
        instanceId,
      });
      expect(removed.accepted).toBe(true);
      const after = await trial.getState(campaign);
      expect(after.entities["pc:hero"]?.activeFearStress?.length ?? 0).toBe(0);
      return;
    }

    expect(instanceId).toBeDefined();
  });

  it("rejects prolonged mental stress slugs", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fear_stress",
      target: "pc:hero",
      fearStressSlug: "srd-2024_short-term-mental-stress",
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("FEAR_STRESS_DELIVERY_NOT_SUPPORTED");
  });

  it("rejects unknown fear/stress slug", async () => {
    await createHero();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_fear_stress",
      target: "pc:hero",
      fearStressSlug: "srd-2024_unknown-fear",
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("FEAR_STRESS_NOT_FOUND");
  });

  it("fear resolves repeat tick at turn start in combat", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => seed + 12000 });
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
          abilityScores: LOW_WIS,
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
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "FearStressApplied");
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
        (e) => e.type === "FearStressTickResolved",
      );
      expect(tickEvents.length).toBeGreaterThan(0);
      found = true;
    }

    expect(found).toBe(true);
  });
});
