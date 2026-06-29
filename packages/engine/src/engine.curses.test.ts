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

const CAMPAIGN = "c:curses";

const LOW_CON: AbilityScores = {
  str: 10,
  dex: 10,
  con: 6,
  int: 10,
  wis: 10,
  cha: 10,
};

describe("Gameplay Toolbox curses (GRILL-LIVE-CURSE)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function createPair() {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:arena", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:cleric",
        kind: "character",
        name: "Cleric",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:victim",
        kind: "npc",
        name: "Victim",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
  }

  async function startCombat(activeFirst: "pc:cleric" | "npc:victim" = "pc:cleric") {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      sceneId: "s:arena",
      combatants: ["pc:cleric", "npc:victim"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative", bonuses: {} });
    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
    if (active !== activeFirst) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
    }
  }

  it("apply_curse rolls an initial save", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_curse",
      target: "npc:victim",
      curseSlug: "srd-2024_sight-rot",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
  });

  it("sight rot applies blinded and tracks instance on failed save", async () => {
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:sr:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "npc:victim",
          kind: "npc",
          name: "Victim",
          abilityScores: LOW_CON,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const result = await trial.execute(campaign, {
        type: "apply_curse",
        target: "npc:victim",
        curseSlug: "srd-2024_sight-rot",
      });
      if (!result.accepted) continue;
      const applied = result.events.find((e) => e.type === "CurseApplied");
      if (!applied || applied.type !== "CurseApplied") continue;
      const blinded = result.events.some(
        (e) =>
          e.type === "ConditionApplied" &&
          (e.payload as { condition: string }).condition === "blinded",
      );
      if (!blinded) continue;

      instanceId = (applied.payload as { instanceId: string }).instanceId;
      expect((applied.payload as { pendingRecovery: boolean }).pendingRecovery).toBe(false);
      break;
    }

    expect(instanceId).toBeDefined();
  });

  it("remove_curse clears instance and blinded condition", async () => {
    await createPair();
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
          id: "npc:victim",
          kind: "npc",
          name: "Victim",
          abilityScores: LOW_CON,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const apply = await trial.execute(campaign, {
        type: "apply_curse",
        target: "npc:victim",
        curseSlug: "srd-2024_sight-rot",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "CurseApplied");
      if (!applied || applied.type !== "CurseApplied") continue;

      instanceId = (applied.payload as { instanceId: string }).instanceId;
      engine = trial;
      break;
    }

    expect(instanceId).toBeDefined();
    if (!instanceId) return;

    const removed = await engine.execute(campaign, {
      type: "remove_curse",
      target: "npc:victim",
      instanceId,
    });
    expect(removed.accepted).toBe(true);
    if (!removed.accepted) return;

    const after = await engine.getState(campaign);
    expect(after.entities["npc:victim"]?.activeCurses?.length ?? 0).toBe(0);
    expect(
      after.entities["npc:victim"]?.conditions?.some((c) => c.condition === "blinded"),
    ).toBe(false);
  });

  it("demonic possession tracks recovery and resolves at turn start", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:dp:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "pc:cleric",
          kind: "character",
          name: "Cleric",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "npc:victim",
          kind: "npc",
          name: "Victim",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const apply = await trial.execute(campaign, {
        type: "apply_curse",
        target: "npc:victim",
        curseSlug: "srd-2024_demonic-possession",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "CurseApplied");
      if (!applied || !(applied.payload as { pendingRecovery?: boolean }).pendingRecovery) {
        continue;
      }

      await trial.execute(campaign, {
        type: "start_encounter",
        sceneId: "s:arena",
        combatants: ["pc:cleric", "npc:victim"],
      });
      await trial.execute(campaign, { type: "roll_initiative", bonuses: {} });

      const state = await trial.getState(campaign);
      const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
      if (active !== "npc:victim") {
        await trial.execute(campaign, { type: "end_turn" });
      }

      const tickState = await trial.getState(campaign);
      const tickEvents = tickState.encounter
        ? (await trial.getEvents(campaign)).filter((e) => e.type === "CurseTickResolved")
        : [];
      expect(tickEvents.length).toBeGreaterThan(0);
      found = true;
    }

    expect(found).toBe(true);
  });

  it("rejects unknown curse slug", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_curse",
      target: "npc:victim",
      curseSlug: "srd-2024_unknown-curse",
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("CURSE_NOT_FOUND");
  });

  it("rejects duplicate slug on apply_curse (Q2 dedupe)", async () => {
    await createPair();
    let campaign = CAMPAIGN;
    let instanceId: string | undefined;

    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      campaign = `${CAMPAIGN}:dup:${seed}`;
      await trial.execute(campaign, {
        type: "create_scene",
        scene: { id: "s:arena", name: "Arena" },
      });
      await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "npc:victim",
          kind: "npc",
          name: "Victim",
          abilityScores: LOW_CON,
          maxHp: 40,
          baseAc: 10,
          sceneId: "s:arena",
        },
      });

      const first = await trial.execute(campaign, {
        type: "apply_curse",
        target: "npc:victim",
        curseSlug: "srd-2024_sight-rot",
      });
      if (!first.accepted) continue;
      const applied = first.events.find((e) => e.type === "CurseApplied");
      if (!applied || applied.type !== "CurseApplied") continue;

      instanceId = (applied.payload as { instanceId: string }).instanceId;
      engine = trial;
      break;
    }

    expect(instanceId).toBeDefined();
    if (!instanceId) return;

    const duplicate = await engine.execute(campaign, {
      type: "apply_curse",
      target: "npc:victim",
      curseSlug: "srd-2024_sight-rot",
    });
    expect(duplicate.accepted).toBe(false);
    if (duplicate.accepted) return;
    expect(duplicate.reason.code).toBe("CURSE_ALREADY_ACTIVE");
  });

  async function setupSpellCaster(trial: Engine, campaign: string) {
    await trial.execute(campaign, {
      type: "create_scene",
      scene: { id: "s:arena", name: "Arena" },
    });
    await trial.execute(campaign, { type: "change_scene", sceneId: "s:arena" });
    await trial.execute(campaign, {
      type: "create_entity",
      entity: {
        id: "pc:cleric",
        kind: "character",
        name: "Cleric",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
        classes: [{ class: "Cleric", level: 5 }],
        spellcasting: { ability: "wis" },
      },
    });
    await trial.execute(campaign, {
      type: "create_entity",
      entity: {
        id: "npc:victim",
        kind: "npc",
        name: "Victim",
        abilityScores: LOW_CON,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
  }

  it("Remove Curse spell clears all active curses on target", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:rc:${seed}`;
      await setupSpellCaster(trial, campaign);

      const apply = await trial.execute(campaign, {
        type: "apply_curse",
        target: "npc:victim",
        curseSlug: "srd-2024_sight-rot",
      });
      if (!apply.accepted) continue;
      if (!apply.events.some((e) => e.type === "CurseApplied")) continue;

      const cast = await trial.execute(campaign, {
        type: "cast_spell",
        caster: "pc:cleric",
        spellId: "srd-2024_remove-curse",
        slotLevel: 3,
        targets: ["npc:victim"],
      });
      if (!cast.accepted) continue;
      expect(cast.events.some((e) => e.type === "CurseRemoved")).toBe(true);

      const after = await trial.getState(campaign);
      expect(after.entities["npc:victim"]?.activeCurses?.length ?? 0).toBe(0);
      expect(
        after.entities["npc:victim"]?.conditions?.some((c) => c.condition === "blinded"),
      ).toBe(false);
      found = true;
    }

    expect(found).toBe(true);
  });

  it("Bestow Curse spell applies srd-spell_bestow-curse on failed save", async () => {
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => seed });
      const campaign = `${CAMPAIGN}:bc:${seed}`;
      await setupSpellCaster(trial, campaign);

      const cast = await trial.execute(campaign, {
        type: "cast_spell",
        caster: "pc:cleric",
        spellId: "srd-2024_bestow-curse",
        slotLevel: 3,
        targets: ["npc:victim"],
      });
      if (!cast.accepted) continue;
      if (cast.summary && (cast.summary as { cursed?: boolean }).cursed !== true) {
        continue;
      }
      expect(
        cast.events.some(
          (e) =>
            e.type === "CurseApplied" &&
            (e.payload as { curseSlug: string }).curseSlug === "srd-spell_bestow-curse",
        ),
      ).toBe(true);

      const after = await trial.getState(campaign);
      expect(
        after.entities["npc:victim"]?.activeCurses?.some(
          (c) => c.curseSlug === "srd-spell_bestow-curse",
        ),
      ).toBe(true);
      found = true;
    }

    expect(found).toBe(true);
  });
});
