import { describe, expect, it } from "vitest";

import { allHostileCombatantsDefeated } from "../combat/encounter-outcome";
import { Engine } from "../engine";
import { FIXTURE_BATTLE_FOES_SIDE, FIXTURE_BATTLE_PARTY_SIDE } from "../fixtures/battle";
import { resolveQuestAdvancesOnCombatEnd } from "./combat-triggers";

const CAMPAIGN = "c:quest-combat";

describe("allHostileCombatantsDefeated", () => {
  it("returns true when only party members remain alive", async () => {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:arena", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:a",
        kind: "character",
        name: "A",
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        maxHp: 20,
        baseAc: 10,
        speed: 30,
        sceneId: "s:arena",
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:foe",
        kind: "monster",
        name: "Foe",
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        maxHp: 10,
        baseAc: 10,
        speed: 30,
        sceneId: "s:arena",
      },
    });
    const start = await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:a", "npc:foe"],
      sides: {
        "pc:a": FIXTURE_BATTLE_PARTY_SIDE,
        "npc:foe": FIXTURE_BATTLE_FOES_SIDE,
      },
    });
    expect(start.accepted).toBe(true);
    const damage = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "npc:foe",
      damageType: "slashing",
      source: { amount: 20 },
    });
    expect(damage.accepted).toBe(true);
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["npc:foe"]?.alive).toBe(false);
    expect(allHostileCombatantsDefeated(state)).toBe(true);
  });
});

describe("resolveQuestAdvancesOnCombatEnd", () => {
  it("advances an active quest with a combat-tagged step", () => {
    const advances = resolveQuestAdvancesOnCombatEnd([
      {
        id: "hook:1",
        status: "active",
        title: "Clear the den",
        data: {
          templateSnapshot: {
            id: "t1",
            title: "Clear the den",
            tags: ["combat"],
            steps: [
              { id: "s1", title: "Defeat the bandits", encounterRef: "bandits" },
              { id: "s2", title: "Search the camp" },
            ],
          },
          currentStepId: "s1",
          completedStepIds: [],
        },
      },
    ]);
    expect(advances).toHaveLength(1);
    expect(advances[0]!.status).toBe("active");
    expect(advances[0]!.data.currentStepId).toBe("s2");
    expect(advances[0]!.line).toContain("Search the camp");
  });
});
