import { describe, expect, it } from "vitest";

import type { AbilityScores } from "../entities/types";
import type { DraftEvent, EngineEvent } from "../events/types";
import { InMemoryEventStore } from "../events/store";
import { applyEvent, emptyWorldState, rebuild } from "./world-state";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

async function seedLog(): Promise<EngineEvent[]> {
  const store = new InMemoryEventStore();
  const drafts: DraftEvent[] = [
    {
      type: "SceneCreated",
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: { scene: { id: "scene:1", name: "Tavern" } },
    },
    {
      type: "SceneChanged",
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: { sceneId: "scene:1" },
    },
    {
      type: "EntityCreated",
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: {
        entity: {
          id: "pc:thorin",
          kind: "character",
          name: "Thorin",
          abilityScores: ABILITIES,
          maxHp: 30,
          baseAc: 16,
        },
      },
    },
  ];
  return store.append("c1", drafts);
}

describe("WorldState projection", () => {
  it("rebuilds scenes, current scene, and entities", async () => {
    const state = rebuild("c1", await seedLog());
    expect(state.scenes["scene:1"]?.name).toBe("Tavern");
    expect(state.currentSceneId).toBe("scene:1");
    expect(state.entities["pc:thorin"]?.hp.max).toBe(30);
    expect(state.lastSequence).toBe(3);
  });

  it("applies damage and clamps at zero, flipping alive", async () => {
    let state = rebuild("c1", await seedLog());
    state = applyEvent(state, {
      type: "DamageDealt",
      sequence: 4,
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: {
        target: "pc:thorin",
        amount: 50,
        damageType: "slashing",
        hpBefore: 30,
        hpAfter: 0,
      },
    });
    expect(state.entities["pc:thorin"]?.hp.current).toBe(0);
    expect(state.entities["pc:thorin"]?.alive).toBe(false);
  });

  it("temp HP soaks damage before current HP", async () => {
    let state = rebuild("c1", await seedLog());
    state.entities["pc:thorin"]!.hp.temp = 5;
    state = applyEvent(state, {
      type: "DamageDealt",
      sequence: 4,
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: {
        target: "pc:thorin",
        amount: 8,
        damageType: "fire",
        hpBefore: 30,
        hpAfter: 27,
      },
    });
    const hp = state.entities["pc:thorin"]!.hp;
    expect(hp.temp).toBe(0);
    expect(hp.current).toBe(27);
  });

  it("healing clamps at max", async () => {
    let state = rebuild("c1", await seedLog());
    state.entities["pc:thorin"]!.hp.current = 10;
    state = applyEvent(state, {
      type: "HealingApplied",
      sequence: 4,
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: { target: "pc:thorin", amount: 100, hpBefore: 10, hpAfter: 30 },
    });
    expect(state.entities["pc:thorin"]?.hp.current).toBe(30);
  });

  it("does not mutate the previous state object (immutability)", async () => {
    const before = rebuild("c1", await seedLog());
    const beforeHp = before.entities["pc:thorin"]!.hp.current;
    applyEvent(before, {
      type: "DamageDealt",
      sequence: 4,
      campaignId: "c1",
      timestamp: 0,
      causedByCommandId: "cmd",
      payload: {
        target: "pc:thorin",
        amount: 10,
        damageType: "slashing",
        hpBefore: 30,
        hpAfter: 20,
      },
    });
    expect(before.entities["pc:thorin"]?.hp.current).toBe(beforeHp);
  });

  it("empty state has no entities or scenes", () => {
    const state = emptyWorldState("c1");
    expect(Object.keys(state.entities)).toHaveLength(0);
    expect(state.lastSequence).toBe(0);
  });
});
