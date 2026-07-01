import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { Engine, InMemoryEventStore } from "../index";
import { sceneIdForDungeonFloor } from "../fixtures/exploration";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-17 reload dungeon layout", () => {
  async function seedAndEnter(engine: Engine, campaign: string) {
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: settlementScene,
        name: "Hamlet",
        map: { width: 10, height: 10, blockedCells: [] },
      },
    });
    await engine.execute(campaign, { type: "change_scene", sceneId: settlementScene });
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
        sceneId: settlementScene,
        position: { x: 2, y: 2 },
      },
    });
    await engine.execute(campaign, {
      type: "enter_dungeon",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      entryZoneId: "entry",
      zoneName: "Entry Hall",
      locationName: "Crypt",
      entityData: samples.minimalTwoZoneFloor,
    });
    return sceneIdForDungeonFloor(DUNGEON_ID, 0);
  }

  it("patches live floor scene map after reload_dungeon_layout", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun17-reload";
    const floor0 = await seedAndEnter(engine, campaign);

    const edited = {
      floors: [
        {
          ...samples.minimalTwoZoneFloor.floors[0]!,
          map: {
            width: 14,
            height: 12,
            blockedCells: [{ x: 0, y: 0 }],
          },
        },
      ],
    };

    const reload = await engine.execute(campaign, {
      type: "reload_dungeon_layout",
      dungeonEntityId: DUNGEON_ID,
      entityData: edited,
    });
    expect(reload.accepted).toBe(true);

    const after = await engine.getState(campaign);
    const scene = after.scenes[floor0];
    expect(scene?.map?.blockedCells?.some((c) => c.x === 0 && c.y === 0)).toBe(
      true,
    );
    expect(after.dungeonLayouts?.[DUNGEON_ID]?.floors[0]?.map.blockedCells).toEqual(
      [{ x: 0, y: 0 }],
    );
  });
});
