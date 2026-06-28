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

const CAMPAIGN = "c:poisons";

describe("Gameplay Toolbox poisons (GRILL-LIVE-POISON)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function createPair(opts?: { coatAttacker?: boolean }) {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:arena", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:rogue",
        kind: "character",
        name: "Rogue",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:bandit",
        kind: "npc",
        name: "Bandit",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 10,
        sceneId: "s:arena",
      },
    });
    if (opts?.coatAttacker) {
      await engine.execute(CAMPAIGN, {
        type: "coat_weapon",
        entity: "pc:rogue",
        poisonSlug: "srd-2024_serpent-venom",
      });
    }
  }

  async function startTwoCombatants(activeFirst: "pc:rogue" | "npc:bandit" = "pc:rogue") {
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      sceneId: "s:arena",
      combatants: ["pc:rogue", "npc:bandit"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative", bonuses: {} });
    const state = await engine.getState(CAMPAIGN);
    const active = state.encounter?.order[state.encounter.activeIndex]?.entity;
    if (active !== activeFirst) {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
    }
  }

  it("coat_weapon sets coatedPoisonSlug out of combat", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "coat_weapon",
      entity: "pc:rogue",
      poisonSlug: "srd-2024_serpent-venom",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "WeaponCoated")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:rogue"]?.coatedPoisonSlug).toBe("srd-2024_serpent-venom");
  });

  it("rejects coating with ingested poison", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "coat_weapon",
      entity: "pc:rogue",
      poisonSlug: "srd-2024_assassins-blood",
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason.code).toBe("POISON_WRONG_TYPE");
  });

  it("coat_weapon spends an action in combat", async () => {
    await createPair();
    await startTwoCombatants("pc:rogue");

    const result = await engine.execute(CAMPAIGN, {
      type: "coat_weapon",
      entity: "pc:rogue",
      poisonSlug: "srd-2024_serpent-venom",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "ActionSpent")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:rogue"]?.actionEconomy?.action).toBe("used");
    expect(state.entities["pc:rogue"]?.coatedPoisonSlug).toBe("srd-2024_serpent-venom");
  });

  it("apply_poison ingested resolves save and damage", async () => {
    await createPair();
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_poison",
      target: "npc:bandit",
      poisonSlug: "srd-2024_assassins-blood",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
    expect(result.events.some((e) => e.type === "DamageDealt")).toBe(true);
  });

  it("coated weapon delivers serpent venom on slashing hit and clears coat", async () => {
    await createPair({ coatAttacker: true });
    const result = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:rogue",
      target: "npc:bandit",
      attackBonus: 10,
      damage: { notation: "1d6", type: "slashing" },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);
    expect(result.events.some((e) => e.type === "PoisonCoatingCleared")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:rogue"]?.coatedPoisonSlug).toBeUndefined();
  });

  it("does not deliver coated poison on bludgeoning hits", async () => {
    await createPair({ coatAttacker: true });
    const result = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:rogue",
      target: "npc:bandit",
      attackBonus: 10,
      damage: { notation: "1d6", type: "bludgeoning" },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "PoisonApplied")).toBe(false);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:rogue"]?.coatedPoisonSlug).toBe("srd-2024_serpent-venom");
  });

  it("Pale Tincture failed initial save adds repeating instance", async () => {
    await createPair();
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      await trial.execute(`${CAMPAIGN}:${seed}`, {
        type: "create_entity",
        entity: {
          id: "pc:victim",
          kind: "character",
          name: "Victim",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
        },
      });
      const result = await trial.execute(`${CAMPAIGN}:${seed}`, {
        type: "apply_poison",
        target: "pc:victim",
        poisonSlug: "srd-2024_pale-tincture",
      });
      if (!result.accepted) continue;
      const applied = result.events.find((e) => e.type === "PoisonApplied");
      if (applied && (applied.payload as { pendingRepeat: boolean }).pendingRepeat) {
        found = true;
        const state = await trial.getState(`${CAMPAIGN}:${seed}`);
        expect(state.entities["pc:victim"]?.activePoisons?.[0]?.pendingRepeat).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  async function applyPaleTinctureWithRepeat(
    target = "npc:bandit",
  ): Promise<{ trial: Engine; campaign: string; instanceId: string }> {
    for (let seed = 0; seed < 200; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:pt:${seed}`;
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: target,
          kind: "npc",
          name: "Victim",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
        },
      });
      const apply = await trial.execute(campaign, {
        type: "apply_poison",
        target,
        poisonSlug: "srd-2024_pale-tincture",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "PoisonApplied");
      if (applied && (applied.payload as { pendingRepeat: boolean }).pendingRepeat) {
        return {
          trial,
          campaign,
          instanceId: (applied.payload as { instanceId: string }).instanceId,
        };
      }
    }
    throw new Error("Could not seed Pale Tincture with pending repeat");
  }

  it("Pale Tincture repeat tick on failed save reduces max HP", async () => {
    let reduced = false;
    for (let seed = 0; seed < 200 && !reduced; seed += 1) {
      const trial = new Engine({ now: () => 0 });
      const campaign = `${CAMPAIGN}:pt-reduce:${seed}`;
      await trial.execute(campaign, {
        type: "create_entity",
        entity: {
          id: "npc:bandit",
          kind: "npc",
          name: "Victim",
          abilityScores: ABILITIES,
          maxHp: 40,
          baseAc: 10,
        },
      });
      const apply = await trial.execute(campaign, {
        type: "apply_poison",
        target: "npc:bandit",
        poisonSlug: "srd-2024_pale-tincture",
      });
      if (!apply.accepted) continue;
      const applied = apply.events.find((e) => e.type === "PoisonApplied");
      if (!applied || !(applied.payload as { pendingRepeat: boolean }).pendingRepeat) {
        continue;
      }
      const instanceId = (applied.payload as { instanceId: string }).instanceId;
      const beforeMax = (await trial.getState(campaign)).entities["npc:bandit"]!.hp.max;
      const tick = await trial.execute(campaign, {
        type: "resolve_poison_tick",
        entity: "npc:bandit",
        instanceId,
      });
      if (!tick.accepted) continue;
      if (!tick.events.some((e) => e.type === "MaxHpReduced")) continue;
      reduced = true;
      const state = await trial.getState(campaign);
      expect(state.entities["npc:bandit"]!.hp.max).toBeLessThan(beforeMax);
      expect(
        state.entities["npc:bandit"]?.activePoisons?.some((p) => p.instanceId === instanceId),
      ).toBe(true);
    }
    expect(reduced).toBe(true);
  });

  it("Pale Tincture repeat tick on successful save removes instance", async () => {
    const { trial, campaign, instanceId } = await applyPaleTinctureWithRepeat();
    let removed = false;

    for (let attempt = 0; attempt < 30 && !removed; attempt += 1) {
      const tick = await trial.execute(campaign, {
        type: "resolve_poison_tick",
        entity: "npc:bandit",
        instanceId,
      });
      if (!tick.accepted) continue;
      if (tick.events.some((e) => e.type === "PoisonRemoved")) {
        removed = true;
        const state = await trial.getState(campaign);
        expect(state.entities["npc:bandit"]?.activePoisons?.length ?? 0).toBe(0);
      }
    }
    expect(removed).toBe(true);
  });

  it("auto-resolves repeat poison tick at turn start", async () => {
    await createPair();
    const apply = await engine.execute(CAMPAIGN, {
      type: "apply_poison",
      target: "pc:rogue",
      poisonSlug: "srd-2024_pale-tincture",
    });
    expect(apply.accepted).toBe(true);
    if (!apply.accepted) return;
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:rogue"]?.activePoisons?.length,
    ).toBeGreaterThan(0);

    await startTwoCombatants("npc:bandit");

    const endTurn = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(endTurn.accepted).toBe(true);
    if (!endTurn.accepted) return;
    expect(endTurn.events.some((e) => e.type === "PoisonTickResolved")).toBe(true);
  });
});
