import { describe, expect, it } from "vitest";

import { Engine, InMemoryEventStore } from "../index";
import {
  buildDungeonEntryCommands,
  buildEnterLocationCommands,
  buildLocationNpcCommands,
  entityIdFromSceneId,
  extractOpeningHookText,
  matchTravelDestination,
  openingNarrationForLocation,
  arrivalNarrationForLocation,
  realmNpcEntityId,
  resolveDungeonFoes,
  sceneIdForRealmEntity,
  type CampaignStartingLocation,
} from "./exploration";

const TAVERN: CampaignStartingLocation = {
  entityId: "11111111-1111-4111-8111-111111111111",
  name: "The Crooked Tankard",
  summary: "Smoke and laughter spill from the open door.",
  type: "tavern",
};

const SETTLEMENT: CampaignStartingLocation = {
  entityId: "22222222-2222-4222-8222-222222222222",
  name: "Ferryrest",
  summary: "A humble hamlet on the riverbank.",
  type: "settlement",
};

describe("matchTravelDestination", () => {
  it("matches an explicit go-to by name", () => {
    expect(
      matchTravelDestination("I go to The Crooked Tankard", [SETTLEMENT, TAVERN]),
    ).toEqual(TAVERN);
  });

  it("matches a type shorthand when travel intent is present", () => {
    expect(
      matchTravelDestination("I head to the tavern", [SETTLEMENT, TAVERN], SETTLEMENT.entityId),
    ).toEqual(TAVERN);
  });

  it("does not match when already at the destination", () => {
    expect(
      matchTravelDestination("I go to Ferryrest", [SETTLEMENT, TAVERN], SETTLEMENT.entityId),
    ).toBeUndefined();
  });

  it("does not match unrelated chatter", () => {
    expect(matchTravelDestination("I ask the barkeep for ale", [TAVERN])).toBeUndefined();
  });
});

describe("buildEnterLocationCommands", () => {
  it("creates the scene, changes to it, and relocates party PCs", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "camp-travel";

    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: sceneIdForRealmEntity(SETTLEMENT.entityId),
        name: SETTLEMENT.name,
        description: "Start",
        map: { width: 14, height: 12, blockedCells: [] },
      },
    });
    await engine.execute(campaign, { type: "change_scene", sceneId: sceneIdForRealmEntity(SETTLEMENT.entityId) });
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
        sceneId: sceneIdForRealmEntity(SETTLEMENT.entityId),
        position: { x: 4, y: 6 },
      },
    });

    const before = await engine.getState(campaign);
    for (const command of buildEnterLocationCommands(TAVERN, before)) {
      await engine.execute(campaign, command);
    }

    const after = await engine.getState(campaign);
    expect(after.currentSceneId).toBe(sceneIdForRealmEntity(TAVERN.entityId));
    expect(after.scenes[sceneIdForRealmEntity(TAVERN.entityId)]?.name).toBe("The Crooked Tankard");
    expect(after.entities["char:hero"]?.sceneId).toBe(sceneIdForRealmEntity(TAVERN.entityId));
    expect(after.encounter).toBeUndefined();
  });
});

describe("entityIdFromSceneId", () => {
  it("round-trips Realms scene ids", () => {
    expect(entityIdFromSceneId(sceneIdForRealmEntity(TAVERN.entityId))).toBe(TAVERN.entityId);
  });
});

describe("extractOpeningHookText", () => {
  it("reads a plain-string hook", () => {
    expect(extractOpeningHookText({ hooks: ["The cellar door won't stay shut."] })).toBe(
      "The cellar door won't stay shut.",
    );
  });

  it("reads structured hook objects", () => {
    expect(
      extractOpeningHookText({
        hooks: [{ title: "Missing child", description: "A boy vanished last night." }],
      }),
    ).toBe("Missing child: A boy vanished last night.");
  });
});

describe("openingNarrationForLocation", () => {
  it("weaves the opening hook into the GM line", () => {
    const line = openingNarrationForLocation({
      ...TAVERN,
      openingHook: "Someone stole the sign.",
    });
    expect(line.text).toContain("Word reaches you:");
    expect(line.text).toContain("Someone stole the sign.");
  });
});

describe("buildLocationNpcCommands", () => {
  it("places realm NPC tokens on the scene", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "camp-npcs";
    const sceneId = sceneIdForRealmEntity(TAVERN.entityId);

    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: sceneId,
        name: TAVERN.name,
        description: "Tavern",
        map: { width: 10, height: 8, blockedCells: [] },
      },
    });

    const state = await engine.getState(campaign);
    const npcId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    for (const command of buildLocationNpcCommands(sceneId, [
      {
        entityId: npcId,
        name: "Barkeep",
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 12 },
        maxHp: 12,
        baseAc: 10,
        speed: 30,
      },
    ], state)) {
      await engine.execute(campaign, command);
    }

    const after = await engine.getState(campaign);
    expect(after.entities[realmNpcEntityId(npcId)]?.name).toBe("Barkeep");
    expect(after.entities[realmNpcEntityId(npcId)]?.kind).toBe("npc");
  });
});

describe("buildDungeonEntryCommands", () => {
  it("starts combat when entering a dungeon", async () => {
    const store = new InMemoryEventStore();
    const engine = new Engine({ store });
    const campaign = "camp-dungeon";
    const dungeon: CampaignStartingLocation = {
      entityId: "33333333-3333-4333-8333-333333333333",
      name: "Whisper Crypt",
      summary: "Damp stone and old bones.",
      type: "dungeon",
    };
    const settlementScene = sceneIdForRealmEntity(SETTLEMENT.entityId);

    await engine.execute(campaign, {
      type: "create_scene",
      scene: {
        id: settlementScene,
        name: SETTLEMENT.name,
        description: "Start",
        map: { width: 14, height: 12, blockedCells: [] },
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
        position: { x: 4, y: 6 },
      },
    });

    const before = await engine.getState(campaign);
    const foes = resolveDungeonFoes(dungeon.entityId, { wanderingMonsters: ["goblin scouts"] });
    for (const command of buildDungeonEntryCommands(dungeon, before, foes)) {
      await engine.execute(campaign, command);
    }

    const after = await engine.getState(campaign);
    expect(after.currentSceneId).toBe(sceneIdForRealmEntity(dungeon.entityId));
    expect(after.encounter?.initiativeRolled).toBe(true);
    expect(Object.keys(after.entities).some((id) => id.startsWith("npc:dungeon:"))).toBe(true);
  });
});

describe("resolveDungeonFoes", () => {
  it("prefers the first room encounter over wandering monsters (GENR-5)", () => {
    const foes = resolveDungeonFoes("33333333-3333-4333-8333-333333333333", {
      rooms: [
        {
          name: "Flooded Antechamber",
          encounter: "3 goblin scouts lurk in the shallows",
        },
      ],
      wanderingMonsters: ["skeleton patrol"],
    });
    expect(foes).toHaveLength(3);
    expect(foes[0]?.name.toLowerCase()).toContain("goblin");
  });

  it("falls back to wandering monsters when rooms have no encounter", () => {
    const foes = resolveDungeonFoes("33333333-3333-4333-8333-333333333333", {
      rooms: [{ name: "Empty Hall", encounter: "" }],
      wanderingMonsters: ["wolf pack"],
    });
    expect(foes[0]?.name.toLowerCase()).toContain("wolf");
  });
});

describe("arrivalNarrationForLocation", () => {
  it("names the first dungeon room on entry when room data exists", () => {
    const line = arrivalNarrationForLocation(
      {
        entityId: "33333333-3333-4333-8333-333333333333",
        name: "Whisper Crypt",
        summary: "Damp stone.",
        type: "dungeon",
      },
      {
        rooms: [{ name: "Flooded Antechamber", encounter: "2 skeletons" }],
      },
    );
    expect(line.text).toContain("Flooded Antechamber");
  });
});
