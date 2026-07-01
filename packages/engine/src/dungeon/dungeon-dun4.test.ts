import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { Engine, InMemoryEventStore } from "../index";
import { sceneIdForDungeonFloor } from "../fixtures/exploration";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-4 interact_object", () => {
  async function seedHero(
    engine: Engine,
    campaign: string,
    sceneId: string,
    position: { x: number; y: number },
  ) {
    await engine.execute(campaign, {
      type: "create_entity",
      entity: {
        id: "char:hero",
        kind: "character",
        name: "Hero",
        abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
        maxHp: 20,
        baseAc: 14,
        speed: 30,
        classes: [{ class: "Fighter", level: 1 }],
        sceneId,
        position,
      },
    });
  }

  it("takes a silent chest and records object state", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun4-chest";
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    const entityData = samples.zoneWithChest;
    const floor0 = sceneIdForDungeonFloor(DUNGEON_ID, 0);

    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: settlementScene,
        name: "Hamlet",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    });
    await engine.execute(campaign, { type: "change_scene", sceneId: settlementScene });
    await seedHero(engine, campaign, settlementScene, { x: 2, y: 2 });

    await engine.execute(campaign, {
      type: "enter_dungeon",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      entryZoneId: "entry",
      zoneName: "Entry Hall",
      locationName: "Crypt",
      entityData,
    });

    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: { x: 3, y: 3 },
    });

    const take = await engine.execute(campaign, {
      type: "interact_object",
      entity: "char:hero",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      zoneId: "entry",
      objectId: "chest-1",
    });
    expect(take.accepted).toBe(true);

    const after = await engine.getState(campaign);
    expect(after.dungeonProgress?.objectStates?.["chest-1"]?.takenByEntityId).toBe(
      "char:hero",
    );

    const repeat = await engine.execute(campaign, {
      type: "interact_object",
      entity: "char:hero",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      zoneId: "entry",
      objectId: "chest-1",
    });
    expect(repeat.accepted).toBe(false);
  });

  it("rejects interact when the actor is not beside the object", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun4-far";
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    const entityData = samples.zoneWithChest;
    const floor0 = sceneIdForDungeonFloor(DUNGEON_ID, 0);

    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: settlementScene,
        name: "Hamlet",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    });
    await engine.execute(campaign, { type: "change_scene", sceneId: settlementScene });
    await seedHero(engine, campaign, settlementScene, { x: 2, y: 2 });

    await engine.execute(campaign, {
      type: "enter_dungeon",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      entryZoneId: "entry",
      zoneName: "Entry Hall",
      locationName: "Crypt",
      entityData,
    });

    const state = await engine.getState(campaign);
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: { x: 1, y: 2 },
    });

    const far = await engine.execute(campaign, {
      type: "interact_object",
      entity: "char:hero",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      zoneId: "entry",
      objectId: "chest-1",
    });
    expect(far.accepted).toBe(false);
  });
});

describe("DUN-4 quest completionKind", () => {
  it("advances on enter_zone and interact_object", async () => {
    const { resolveQuestAdvancesOnEnterZone, resolveQuestAdvancesOnInteractObject } =
      await import("../quests/step-triggers");

    const dungeonId = DUNGEON_ID;
    const instance = {
      id: "hook:dun4",
      status: "active" as const,
      title: "Loot the crypt",
      data: {
        templateSnapshot: {
          id: "q-dun4",
          title: "Loot the crypt",
          steps: [
            {
              id: "s1",
              title: "Reach the entry hall",
              completionKind: "enter_zone",
              dungeonEntityId: dungeonId,
              zoneId: "entry",
            },
            {
              id: "s2",
              title: "Open the chest",
              completionKind: "interact",
              dungeonEntityId: dungeonId,
              zoneId: "entry",
              objectId: "chest-1",
            },
          ],
        },
        currentStepId: "s1",
        completedStepIds: [],
      },
    };

    const enter = resolveQuestAdvancesOnEnterZone([instance], dungeonId, "entry");
    expect(enter).toHaveLength(1);
    expect(enter[0]!.data.currentStepId).toBe("s2");

    const loot = resolveQuestAdvancesOnInteractObject(
      [{ ...instance, data: enter[0]!.data as typeof instance.data }],
      dungeonId,
      "entry",
      "chest-1",
    );
    expect(loot).toHaveLength(1);
    expect(loot[0]!.status).toBe("resolved");
  });
});
