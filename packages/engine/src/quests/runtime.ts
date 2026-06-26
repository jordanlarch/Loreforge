import {
  parseQuestInstanceData,
  templateFromInstance,
  type QuestInstanceRef,
} from "./instance";
import {
  evaluateQuestPrerequisites,
  type QuestPrerequisiteContext,
} from "./prerequisites";
import type { QuestTemplate, QuestTrigger } from "./types";

export type NpcRef = { entityId: string; name: string };

function matchesTalkTrigger(
  trigger: QuestTrigger,
  npcEntityId: string,
  template: QuestTemplate,
): boolean {
  if (trigger.type !== "on_talk_to_npc" || trigger.delivery !== "offer") {
    return false;
  }
  const configNpc = trigger.config?.npcEntityId;
  if (configNpc && configNpc !== npcEntityId) return false;
  const giver = template.questGiverNpcEntityId;
  if (giver && giver !== npcEntityId) return false;
  return true;
}

function offerBody(template: QuestTemplate): string | undefined {
  const text =
    template.offerText?.trim() ||
    template.description?.trim() ||
    template.teaseText?.trim() ||
    template.title.trim();
  return text.length > 0 ? text : undefined;
}

function briefingBody(template: QuestTemplate, currentStepId?: string): string {
  const parts: string[] = [];
  const instructions = template.gmInstructions?.trim();
  if (instructions) parts.push(instructions);
  const step =
    template.steps?.find((s) => s.id === currentStepId) ?? template.steps?.[0];
  if (step) {
    parts.push(`Current objective: ${step.title}`);
    const stepGm = step.gmInstructions?.trim();
    if (stepGm) parts.push(stepGm);
  }
  return parts.join(" ");
}

/** Format quest offer copy for a GM chat line (Phase C). */
export function formatQuestOfferLine(offer: string, npcName: string): string {
  const trimmed = offer.trim();
  const sentence = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return `${npcName} leans in: "${sentence}" Accept the quest from the Campaign Quests tab when you're ready.`;
}

/** Format quest briefing for session-start / activate delivery (Phase C). */
export function formatQuestBriefingLine(
  template: QuestTemplate,
  currentStepId?: string,
): string {
  const body = briefingBody(template, currentStepId);
  if (!body.trim()) {
    return `The quest "${template.title}" is now active. Check the Quests tab for objectives.`;
  }
  return `Quest briefing — ${template.title}: ${body}`;
}

/** Whether player text references an NPC by name (case-insensitive). */
export function playerTextReferencesNpc(
  playerText: string,
  npcName: string,
): boolean {
  const needle = npcName.trim().toLowerCase();
  if (needle.length < 3) return false;
  return playerText.toLowerCase().includes(needle);
}

function npcCanDeliverOffer(
  template: QuestTemplate,
  npcEntityId: string,
): boolean {
  const giver = template.questGiverNpcEntityId;
  if (giver && giver !== npcEntityId) return false;

  const triggers = template.triggers ?? [];
  if (template.offerText?.trim()) return true;
  if (triggers.length === 0) return true;
  return triggers.some((t) => matchesTalkTrigger(t, npcEntityId, template));
}

/** Find the first open quest offer when the player talks to an NPC. */
export function resolveQuestOfferForNpc(
  instances: readonly QuestInstanceRef[],
  npc: NpcRef,
  playerText: string,
  prerequisiteContext?: QuestPrerequisiteContext,
): { instanceId: string; questTitle: string; offerText: string } | undefined {
  if (!playerTextReferencesNpc(playerText, npc.name)) return undefined;

  for (const instance of instances) {
    if (instance.status !== "open") continue;
    const template = templateFromInstance(instance);
    if (!template) continue;

    if (prerequisiteContext) {
      const gate = evaluateQuestPrerequisites(template, prerequisiteContext);
      if (!gate.met) continue;
    }

    if (!npcCanDeliverOffer(template, npc.entityId)) continue;

    const body = offerBody(template);
    if (!body) continue;

    return {
      instanceId: instance.id,
      questTitle: template.title,
      offerText: body,
    };
  }
  return undefined;
}

/** Active quests that still need an in-fiction briefing line. */
export function pendingQuestBriefings(
  instances: readonly QuestInstanceRef[],
): { instanceId: string; line: string }[] {
  const pending: { instanceId: string; line: string }[] = [];
  for (const instance of instances) {
    if (instance.status !== "active") continue;
    const parsed = parseQuestInstanceData(instance.data);
    if (parsed.briefingDelivered) continue;
    const template = parsed.templateSnapshot;
    if (!template) continue;
    pending.push({
      instanceId: instance.id,
      line: formatQuestBriefingLine(template, parsed.currentStepId),
    });
  }
  return pending;
}

/** Hot-context block for active quests injected into AI-GM narration (Phase C). */
export function buildActiveQuestHotContext(
  instances: readonly QuestInstanceRef[],
  limit = 3,
): string {
  const lines: string[] = [];
  let count = 0;
  for (const instance of instances) {
    if (instance.status !== "active") continue;
    if (count >= limit) break;
    const parsed = parseQuestInstanceData(instance.data);
    const template = parsed.templateSnapshot;
    if (!template) continue;
    count += 1;
    const step =
      template.steps?.find((s) => s.id === parsed.currentStepId) ??
      template.steps?.[0];
    const parts = [`Active quest: ${template.title}`];
    if (step) parts.push(`Current step: ${step.title}`);
    const gm = step?.gmInstructions?.trim() || template.gmInstructions?.trim();
    if (gm) parts.push(`GM instructions (canon): ${gm}`);
    parts.push(
      "Do not mark steps complete or grant rewards unless the engine or player actions require it.",
    );
    lines.push(parts.join(". "));
  }
  if (lines.length === 0) return "";
  return ["Active quests (canon — follow GM instructions):", ...lines].join(
    "\n",
  );
}

/** Mark briefing delivered in instance data (immutable update). */
export function markBriefingDelivered(data: unknown): Record<string, unknown> {
  const base = typeof data === "object" && data !== null ? { ...data } : {};
  return { ...base, briefingDelivered: true };
}
