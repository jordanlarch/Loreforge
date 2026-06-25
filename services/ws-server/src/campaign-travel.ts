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
} from "./db.js";
import { CampaignRoom } from "./room.js";

export async function tryCampaignTravelFromChat(
  room: CampaignRoom,
  campaignId: string,
  message: { mode?: string; text: string },
): Promise<CampaignStartingLocation | undefined> {
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

  const { changed } = await room.enterLocation(destination);
  return changed ? destination : undefined;
}
