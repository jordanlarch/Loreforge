/**
 * Campaign quest Live Play runtime (Phase B/C) — offer, briefing, hot context.
 */
import {
  buildActiveQuestHotContext,
  entityIdFromSceneId,
  formatQuestOfferLine,
  markBriefingDelivered,
  pendingQuestBriefings,
  resolveQuestOfferForNpc,
  type QuestInstanceRef,
} from "@app/engine";

import type { ChatEntry } from "./chat.js";
import { gmEntry, type ChatDeps } from "./chat.js";
import {
  getCampaignNpcsAtLocation,
  loadCampaignQuestInstances,
  loadQuestPrerequisiteContext,
  updatePlotHookData,
} from "./db.js";
import type { LiveRoom } from "./room.js";

/** Active quest hot-context block for AI-GM narration. */
export async function activeQuestContextForCampaign(
  campaignId: string,
): Promise<string> {
  const instances = await loadCampaignQuestInstances(campaignId);
  return buildActiveQuestHotContext(instances);
}

/** Deliver pending briefing GM lines when quests become Active. */
export async function appendPendingQuestBriefings(
  campaignId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  const instances = await loadCampaignQuestInstances(campaignId);
  const briefings = pendingQuestBriefings(instances);
  if (briefings.length === 0) return;

  const entries: ChatEntry[] = briefings.map((b) =>
    gmEntry(b.line, chatDeps),
  );
  await append(entries);

  for (const b of briefings) {
    const row = instances.find((i) => i.id === b.instanceId);
    if (!row) continue;
    await updatePlotHookData(
      b.instanceId,
      markBriefingDelivered(row.data) as Record<string, unknown>,
    );
  }
}

/** Resolve quest offer when the player speaks to an on-scene NPC. */
export async function tryQuestOfferFromChat(
  campaignId: string,
  room: LiveRoom,
  message: { mode?: string; text: string },
  chatDeps: ChatDeps,
): Promise<ChatEntry | undefined> {
  if (message.mode && message.mode !== "speak") return undefined;
  const text = message.text.trim();
  if (text.length === 0) return undefined;

  const state = await room.getState();
  const locationEntityId = entityIdFromSceneId(state.currentSceneId);
  if (!locationEntityId || locationEntityId === "generic") return undefined;

  const npcs = await getCampaignNpcsAtLocation(campaignId, locationEntityId);
  if (npcs.length === 0) return undefined;

  const instances = await loadCampaignQuestInstances(campaignId);
  const prereqCtx = await loadQuestPrerequisiteContext(campaignId);
  for (const npc of npcs) {
    const offer = resolveQuestOfferForNpc(
      instances as QuestInstanceRef[],
      { entityId: npc.entityId, name: npc.name },
      text,
      prereqCtx,
    );
    if (!offer) continue;
    return gmEntry(formatQuestOfferLine(offer.offerText, npc.name), chatDeps, {
      mentions: [npc.name],
    });
  }
  return undefined;
}
