import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { Engine, InMemoryEventStore } from "../index";
import { sceneIdForDungeonFloor } from "../fixtures/exploration";
import {
  isPatrolEntityId,
  patrolDetectedParty,
  patrolEntityId,
} from "./patrols";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-6 patrols", () => {
  async function seedHero(
    engine: Engine,
    campaign: string,
    sceneId: string,
    position: { x: number; y: number },
    id = "char:hero",
    wis = 10,
  ) {
    await engine.execute(campaign, {
      type: "create_entity",
      entity: {
        id,
        kind: "character",
        name: id,
        abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis, cha: 10 },
        maxHp: 20,
        baseAc: 14,
        speed: 30,
        classes: [{ class: "Fighter", level: 1 }],
        sceneId,
        position,
      },
    });
  }

  async function enterSampleDungeon(
    engine: Engine,
    campaign: string,
    heroWis = 10,
  ) {
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
    await seedHero(engine, campaign, settlementScene, { x: 2, y: 2 }, "char:hero", heroWis);
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

  it("spawns patrol at waypoint 0 on first threshold enter", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun6-spawn";
    const floor0 = await enterSampleDungeon(engine, campaign);
    const after = await engine.getState(campaign);

    const entityId = patrolEntityId(DUNGEON_ID, "ossuary-skeleton");
    expect(isPatrolEntityId(entityId)).toBe(true);
    const patrol = after.entities[entityId];
    expect(patrol?.sceneId).toBe(floor0);
    expect(patrol?.position).toEqual({ x: 7, y: 3 });
    expect(after.dungeonProgress?.patrolStates?.["ossuary-skeleton"]?.waypointIndex).toBe(0);
  });

  it("tick_patrols advances patrol to the next waypoint", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun6-tick";
    await enterSampleDungeon(engine, campaign);
    const entityId = patrolEntityId(DUNGEON_ID, "ossuary-skeleton");

    const tick = await engine.execute(campaign, {
      type: "tick_patrols",
      dungeonEntityId: DUNGEON_ID,
    });
    expect(tick.accepted).toBe(true);

    const after = await engine.getState(campaign);
    expect(after.entities[entityId]?.position).toEqual({ x: 9, y: 3 });
    expect(after.dungeonProgress?.patrolStates?.["ossuary-skeleton"]?.waypointIndex).toBe(1);
  });

  it("reset_patrols returns patrols to waypoint 0 on session load", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun6-reset";
    await enterSampleDungeon(engine, campaign);
    const entityId = patrolEntityId(DUNGEON_ID, "ossuary-skeleton");

    await engine.execute(campaign, {
      type: "tick_patrols",
      dungeonEntityId: DUNGEON_ID,
    });
    await engine.execute(campaign, {
      type: "tick_patrols",
      dungeonEntityId: DUNGEON_ID,
    });

    const reset = await engine.execute(campaign, {
      type: "reset_patrols",
      dungeonEntityId: DUNGEON_ID,
    });
    expect(reset.accepted).toBe(true);

    const after = await engine.getState(campaign);
    expect(after.entities[entityId]?.position).toEqual({ x: 7, y: 3 });
    expect(after.dungeonProgress?.patrolStates?.["ossuary-skeleton"]?.waypointIndex).toBe(0);
  });

  it("tick_patrols skips while an encounter is active", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun6-encounter";
    const floor0 = await enterSampleDungeon(engine, campaign);
    const entityId = patrolEntityId(DUNGEON_ID, "ossuary-skeleton");

    await engine.execute(campaign, {
      type: "start_encounter",
      sceneId: floor0,
      combatants: ["char:hero", entityId],
      sides: { "char:hero": "party", [entityId]: "foes" },
    });

    const tick = await engine.execute(campaign, {
      type: "tick_patrols",
      dungeonEntityId: DUNGEON_ID,
    });
    expect(tick.accepted).toBe(true);
    if (tick.accepted) {
      expect(tick.summary).toMatchObject({ skipped: "encounter" });
    }

    const after = await engine.getState(campaign);
    expect(after.entities[entityId]?.position).toEqual({ x: 7, y: 3 });
  });

  it("patrolDetectedParty is true after patrol detects a party member", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun6-detect";
    const floor0 = await enterSampleDungeon(engine, campaign, 14);
    const entityId = patrolEntityId(DUNGEON_ID, "ossuary-skeleton");
    const layout = (await engine.getState(campaign)).dungeonLayouts![DUNGEON_ID]!;
    const ossuary = layout.floors[0]!.zones[1]!;
    const heroCell = ossuary.cells[1] ?? ossuary.cells[0]!;
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
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: heroCell,
    });

    await engine.execute(campaign, {
      type: "tick_patrols",
      dungeonEntityId: DUNGEON_ID,
    });

    const after = await engine.getState(campaign);
    expect(patrolDetectedParty(after, entityId)).toBe(true);
    expect(after.entities[entityId]?.sceneId).toBe(floor0);
  });
});
