/**
 * Campaign exploration travel (Rung 4 Slice 2) — enter a World-tab Realms
 * location from chat intent or an explicit client `enter_location` message.
 */
import {
  entityIdFromSceneId,
  matchTravelDestination,
  type CampaignStartingLocation,
} from "@app/engine";

import {
  getCampaignExplorableLocations,
  getCampaignLocationEnterExtras,
} from "./db.js";
import { CampaignRoom } from "./room.js";

export type CampaignTravelResult = {
  destination: CampaignStartingLocation;
  startedCombat: boolean;
};

export async function tryCampaignTravelFromChat(
  room: CampaignRoom,
  campaignId: string,
  message: { mode?: string; text: string },
): Promise<CampaignTravelResult | undefined> {
  if (message.mode && message.mode !== "speak" && message.mode !== "action") {
    return undefined;
  }

  const state = await room.getState();
  if (state.encounter) return undefined;

  const locations = await getCampaignExplorableLocations(campaignId);
  const currentEntityId = entityIdFromSceneId(state.currentSceneId);
  const destination = matchTravelDestination(
    message.text,
    locations,
    currentEntityId,
  );
  if (!destination) return undefined;

  const extras = await getCampaignLocationEnterExtras(
    campaignId,
    destination.entityId,
  );
  const { changed, startedCombat } = await room.enterLocation(destination, extras);
  if (!changed) return undefined;
  return { destination, startedCombat };
}
