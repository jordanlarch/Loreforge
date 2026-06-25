import { describe, expect, it, vi } from "vitest";

import {
  InMemoryEventStore,
  sceneIdForRealmEntity,
  type CampaignStartingLocation,
  type PartyMember,
} from "@app/engine";

import { tryCampaignTravelFromChat } from "./campaign-travel.js";
import { CampaignRoom } from "./room.js";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000bb";

const SETTLEMENT: CampaignStartingLocation = {
  entityId: "22222222-2222-4222-8222-222222222222",
  name: "Ferryrest",
  summary: "A humble hamlet.",
  type: "settlement",
};

const TAVERN: CampaignStartingLocation = {
  entityId: "11111111-1111-4111-8111-111111111111",
  name: "The Crooked Tankard",
  summary: "Smoke and laughter.",
  type: "tavern",
};

vi.mock("./db.js", () => ({
  getCampaignExplorableLocations: vi.fn(async () => [SETTLEMENT, TAVERN]),
  getCampaignLocationByEntityId: vi.fn(),
}));

describe("tryCampaignTravelFromChat", () => {
  it("relocates the party when speak-mode names a destination", async () => {
    const store = new InMemoryEventStore();
    const party: PartyMember[] = [
      {
        id: "char:hero",
        name: "Hero",
        abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
        maxHp: 20,
        baseAc: 14,
        speed: 30,
        classes: [{ class: "Fighter", level: 1 }],
      },
    ];
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => party,
      async () => undefined,
      async () => SETTLEMENT,
    );
    await room.getState();

    const destination = await tryCampaignTravelFromChat(room, CAMPAIGN, {
      mode: "speak",
      text: "I go to The Crooked Tankard",
    });

    expect(destination).toEqual(TAVERN);
    const state = await room.getState();
    expect(state.currentSceneId).toBe(sceneIdForRealmEntity(TAVERN.entityId));
    expect(state.encounter).toBeUndefined();
  });
});
