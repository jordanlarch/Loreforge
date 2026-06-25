import { describe, expect, it } from "vitest";

import { Engine, InMemoryEventStore } from "../index";
import {
  buildEnterLocationCommands,
  entityIdFromSceneId,
  matchTravelDestination,
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
