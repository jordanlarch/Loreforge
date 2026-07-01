import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import {
  buildDungeonEntryCommands,
  sceneIdForDungeonFloor,
} from "../fixtures/exploration";
import { resolveDungeonFoes } from "../fixtures/exploration";
import { Engine, InMemoryEventStore } from "../index";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-3 detection + zone encounters", () => {
  it("start_zone_encounter begins combat with visible roster on dungeon enter", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun3-enter";
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    const entityData = { wanderingMonsters: ["3 goblin scouts"] };

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

    const before = await engine.getState(campaign);
    const foes = resolveDungeonFoes(DUNGEON_ID, entityData);
    for (const command of buildDungeonEntryCommands(
      { entityId: DUNGEON_ID, name: "Crypt", summary: "Dark", type: "dungeon" },
      before,
      foes,
      entityData,
    )) {
      await engine.execute(campaign, command);
    }

    const after = await engine.getState(campaign);
    expect(after.encounter?.initiativeRolled).toBe(true);
    expect(Object.keys(after.entities).some((id) => id.startsWith("npc:dungeon:"))).toBe(
      true,
    );
  });

  it("emits CreatureDetected when moving into a zone with a hostile", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun3-move-detect";
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    const floor0 = sceneIdForDungeonFloor(DUNGEON_ID, 0);
    const entityData = samples.minimalTwoZoneFloor;

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
        abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 14, cha: 10 },
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
      zoneName: "Threshold",
      locationName: "Crypt",
      entityData,
    });

    const state = await engine.getState(campaign);
    const layout = state.dungeonLayouts![DUNGEON_ID]!;
    const ossuary = layout.floors[0]!.zones[1]!;
    const foeCell = ossuary.cells[0]!;
    const heroCell = ossuary.cells[1] ?? ossuary.cells[0]!;
    await engine.execute(campaign, {
      type: "create_entity",
      entity: {
        id: "npc:foe:0",
        kind: "monster",
        name: "Goblin",
        abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
        maxHp: 7,
        baseAc: 15,
        speed: 30,
        sceneId: floor0,
        position: foeCell,
      },
    });

    const conn = layout.floors[0]!.zones[0]!.connections[0]!;
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: conn.fromCells[0]!,
    });
    await engine.execute(campaign, {
      type: "use_connection",
      entity: "char:hero",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      connectionId: conn.connectionId,
    });
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: conn.corridorCells[0]!,
    });

    const moveIntoOssuary = await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: heroCell,
    });
    expect(moveIntoOssuary.accepted).toBe(true);

    const after = await engine.getState(campaign);
    expect(after.dungeonProgress?.detectedPairs?.length).toBeGreaterThan(0);
  });
});
