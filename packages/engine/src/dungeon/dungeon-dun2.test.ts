import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { Engine, InMemoryEventStore } from "../index";
import { sceneIdForDungeonFloor } from "../fixtures/exploration";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-2 dungeon commands", () => {
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

  it("registers layout on enter_dungeon and emits ZoneVisited on cross-zone move", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun2-zones";
    const settlement = "22222222-2222-4222-8222-222222222222";
    const settlementScene = `scene:realm:${settlement}`;

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

    const entityData = samples.minimalTwoZoneFloor;

    await engine.execute(campaign, {
      type: "enter_dungeon",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      entryZoneId: "entry",
      zoneName: "Threshold",
      locationName: "Test Crypt",
      entityData,
    });

    let state = await engine.getState(campaign);
    expect(state.dungeonLayouts?.[DUNGEON_ID]?.floors).toHaveLength(1);
    expect(state.dungeonProgress?.visitedZoneIds).toContain("entry");

    const floor0 = sceneIdForDungeonFloor(DUNGEON_ID, 0);
    const layout = state.dungeonLayouts![DUNGEON_ID]!;
    const conn = layout.floors[0]!.zones[0]!.connections[0]!;
    const corridor = conn.corridorCells[0]!;

    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: conn.fromCells[0]!,
    });

    const blocked = await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: corridor,
    });
    expect(blocked.accepted).toBe(false);

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
      to: corridor,
    });

    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: layout.floors[0]!.zones[1]!.cells[0]!,
    });

    state = await engine.getState(campaign);
    expect(state.dungeonProgress?.visitedZoneIds).toContain("ossuary");
    expect(state.entities["char:hero"]?.sceneId).toBe(floor0);
  });

  it("use_floor_transition moves a PC to another floor scene", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun2-stairs";
    const settlementScene = "scene:realm:22222222-2222-4222-8222-222222222222";
    const entityData = samples.twoFloorWithStairs;

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
      entryZoneId: "lower-hall",
      zoneName: "Lower Hall",
      locationName: "Lantern Spire",
      entityData,
    });

    const move = await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: { x: 5, y: 4 },
    });
    expect(move.accepted).toBe(true);

    const transition = await engine.execute(campaign, {
      type: "use_floor_transition",
      entity: "char:hero",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      transitionId: "stairs-up",
    });
    expect(transition.accepted).toBe(true);

    const state = await engine.getState(campaign);
    expect(state.entities["char:hero"]?.sceneId).toBe(
      sceneIdForDungeonFloor(DUNGEON_ID, 1),
    );
    expect(state.entities["char:hero"]?.position).toEqual({ x: 2, y: 3 });
    expect(state.dungeonProgress?.visitedZoneIds).toContain("stair-landing");
  });
});
