/**
 * Campaign quest Live Play runtime (Phase B/C) — offer, briefing, hot context.
 */
import {
  buildActiveQuestHotContext,
  entityIdFromSceneId,
  formatQuestOfferLine,
  markBriefingDelivered,
  markStepAdvanceDelivered,
  pendingQuestBriefings,
  pendingStepAdvanceLines,
  playerTextReferencesNpc,
  resolveQuestAdvancesOnEvent,
  resolveQuestOfferForNpc,
  type QuestAdvanceEvent,
  type QuestInstanceRef,
  type QuestStepAdvance,
} from "@app/engine";

import type { ChatEntry } from "./chat.js";
import { gmEntry, type ChatDeps } from "./chat.js";
import {
  getCampaignNpcsAtLocation,
  loadCampaignQuestInstances,
  loadQuestPrerequisiteContext,
  updatePlotHookData,
  updateQuestInstance,
} from "./db.js";
import type { LiveRoom } from "./room.js";

/** Active quest hot-context block for AI-GM narration. */
export async function activeQuestContextForCampaign(
  campaignId: string,
): Promise<string> {
  const instances = await loadCampaignQuestInstances(campaignId);
  return buildActiveQuestHotContext(instances);
}

async function persistQuestAdvances(
  advances: readonly QuestStepAdvance[],
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  if (advances.length === 0) return;
  await append(advances.map((a) => gmEntry(a.line, chatDeps)));
  for (const advance of advances) {
    await updateQuestInstance(advance.instanceId, {
      data: advance.data,
      status: advance.status,
    });
  }
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

/** Deliver GM lines queued by manual step completion from the Quests tab. */
export async function appendPendingStepAdvanceLines(
  campaignId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  const instances = await loadCampaignQuestInstances(campaignId);
  const pending = pendingStepAdvanceLines(instances);
  if (pending.length === 0) return;

  await append(pending.map((p: { line: string }) => gmEntry(p.line, chatDeps)));

  for (const p of pending) {
    const row = instances.find((i) => i.id === p.instanceId);
    if (!row) continue;
    await updatePlotHookData(
      p.instanceId,
      markStepAdvanceDelivered(row.data) as Record<string, unknown>,
    );
  }
}

async function tryQuestAdvanceOnEvent(
  campaignId: string,
  event: QuestAdvanceEvent,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  const instances = await loadCampaignQuestInstances(campaignId);
  const advances = resolveQuestAdvancesOnEvent(instances, event);
  await persistQuestAdvances(advances, append, chatDeps);
}

/** After victorious combat, auto-advance eligible active quest steps. */
export async function tryQuestAdvanceOnCombatEnd(
  campaignId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  await tryQuestAdvanceOnEvent(
    campaignId,
    { kind: "combat_end" },
    append,
    chatDeps,
  );
}

/** Auto-advance quests when the party enters a location with `on_step_complete`. */
export async function tryQuestAdvanceOnEnterLocation(
  campaignId: string,
  locationEntityId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  await tryQuestAdvanceOnEvent(
    campaignId,
    { kind: "enter_location", locationEntityId },
    append,
    chatDeps,
  );
}

/** Auto-advance quests when the player talks to a quest NPC (`on_step_complete`). */
export async function tryQuestAdvanceOnTalkToNpc(
  campaignId: string,
  npcEntityId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  await tryQuestAdvanceOnEvent(
    campaignId,
    { kind: "talk_to_npc", npcEntityId },
    append,
    chatDeps,
  );
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

/** Auto-advance `on_step_complete` quests when player chat references an on-scene NPC. */
export async function tryQuestAdvanceFromChat(
  campaignId: string,
  room: LiveRoom,
  message: { mode?: string; text: string },
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  if (message.mode && message.mode !== "speak") return;
  const text = message.text.trim();
  if (text.length === 0) return;

  const state = await room.getState();
  const locationEntityId = entityIdFromSceneId(state.currentSceneId);
  if (!locationEntityId || locationEntityId === "generic") return;

  const npcs = await getCampaignNpcsAtLocation(campaignId, locationEntityId);
  for (const npc of npcs) {
    if (!playerTextReferencesNpc(text, npc.name)) continue;
    await tryQuestAdvanceOnTalkToNpc(
      campaignId,
      npc.entityId,
      append,
      chatDeps,
    );
  }
}

/** Pending quest GM lines (briefings + manual step advances). */
export async function appendPendingQuestRuntimeLines(
  campaignId: string,
  append: (entries: ChatEntry[]) => Promise<void>,
  chatDeps: ChatDeps,
): Promise<void> {
  await appendPendingQuestBriefings(campaignId, append, chatDeps);
  await appendPendingStepAdvanceLines(campaignId, append, chatDeps);
}
