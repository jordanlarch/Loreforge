import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { Engine, InMemoryEventStore } from "../index";
import { sceneIdForDungeonFloor } from "../fixtures/exploration";
import { revealedCellKeysFor } from "../dungeon/fog";

const DUNGEON_ID = "33333333-3333-4333-8333-333333333333";

describe("DUN-5 fog reveal", () => {
  async function seedHero(
    engine: Engine,
    campaign: string,
    sceneId: string,
    position: { x: number; y: number },
    id = "char:hero",
  ) {
    await engine.execute(campaign, {
      type: "create_entity",
      entity: {
        id,
        kind: "character",
        name: id,
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

  async function enterSampleDungeon(engine: Engine, campaign: string) {
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
    await seedHero(engine, campaign, settlementScene, { x: 2, y: 2 });
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

  it("reveals entry zone fog for all party on threshold enter", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun5-enter";
    const floor0 = await enterSampleDungeon(engine, campaign);
    const after = await engine.getState(campaign);

    const keys = revealedCellKeysFor(after, "char:hero", floor0);
    expect(keys.size).toBeGreaterThan(0);
    expect(after.dungeonProgress?.discoveredZoneIds).toContain("entry");
  });

  it("reveals vision cells on move and discovers a new zone", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun5-move";
    const floor0 = await enterSampleDungeon(engine, campaign);
    const state = await engine.getState(campaign);
    const layout = state.dungeonLayouts![DUNGEON_ID]!;
    const conn = layout.floors[0]!.zones[0]!.connections[0]!;
    const corridor = conn.corridorCells[0]!;

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
      to: corridor,
    });

    const move = await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:hero",
      to: layout.floors[0]!.zones[1]!.cells[0]!,
    });
    expect(move.accepted).toBe(true);

    const after = await engine.getState(campaign);
    const ossuaryCell = layout.floors[0]!.zones[1]!.cells[0]!;
    const keys = revealedCellKeysFor(after, "char:hero", floor0);
    expect(keys.has(`${ossuaryCell.x},${ossuaryCell.y}`)).toBe(true);
    expect(after.dungeonProgress?.visitedZoneIds).toContain("ossuary");
    expect(after.dungeonProgress?.discoveredZoneIds).toContain("ossuary");
  });

  it("share_scout_reveal copies fog to another party member", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun5-scout";
    const floor0 = await enterSampleDungeon(engine, campaign);

    await seedHero(engine, campaign, floor0, { x: 2, y: 3 }, "char:scout");

    const layout = (await engine.getState(campaign)).dungeonLayouts![DUNGEON_ID]!;
    const conn = layout.floors[0]!.zones[0]!.connections[0]!;
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:scout",
      to: conn.fromCells[0]!,
    });
    await engine.execute(campaign, {
      type: "use_connection",
      entity: "char:scout",
      dungeonEntityId: DUNGEON_ID,
      floorIndex: 0,
      connectionId: conn.connectionId,
    });
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:scout",
      to: conn.corridorCells[0]!,
    });
    await engine.execute(campaign, {
      type: "move_entity",
      entity: "char:scout",
      to: layout.floors[0]!.zones[1]!.cells[0]!,
    });

    const scoutFogBefore = revealedCellKeysFor(
      await engine.getState(campaign),
      "char:scout",
      floor0,
    );
    expect(scoutFogBefore.size).toBeGreaterThan(
      revealedCellKeysFor(await engine.getState(campaign), "char:hero", floor0).size,
    );

    const share = await engine.execute(campaign, {
      type: "share_scout_reveal",
      scout: "char:scout",
    });
    expect(share.accepted).toBe(true);

    const after = await engine.getState(campaign);
    const heroFog = revealedCellKeysFor(after, "char:hero", floor0);
    for (const key of scoutFogBefore) {
      expect(heroFog.has(key)).toBe(true);
    }
  });

  it("reveal_area adds cells for party on a dungeon floor", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "dun5-gm";
    const floor0 = await enterSampleDungeon(engine, campaign);

    const reveal = await engine.execute(campaign, {
      type: "reveal_area",
      sceneId: floor0,
      cells: [{ x: 10, y: 3 }],
    });
    expect(reveal.accepted).toBe(true);

    const after = await engine.getState(campaign);
    expect(revealedCellKeysFor(after, "char:hero", floor0).has("10,3")).toBe(true);
  });
});

describe("DUN-5 quest discover_zone", () => {
  it("advances on ZoneDiscovered via discover_zone resolver", async () => {
    const { resolveQuestAdvancesOnDiscoverZone } = await import("../quests/step-triggers");

    const instance = {
      id: "hook:dun5",
      status: "active" as const,
      title: "Scout the ossuary",
      data: {
        templateSnapshot: {
          id: "q-dun5",
          title: "Scout the ossuary",
          steps: [
            {
              id: "s1",
              title: "Discover the ossuary",
              completionKind: "discover_zone",
              dungeonEntityId: DUNGEON_ID,
              zoneId: "ossuary",
            },
          ],
        },
        currentStepId: "s1",
        completedStepIds: [],
      },
    };

    const advances = resolveQuestAdvancesOnDiscoverZone(
      [instance],
      DUNGEON_ID,
      "ossuary",
    );
    expect(advances).toHaveLength(1);
    expect(advances[0]!.status).toBe("resolved");
  });
});
