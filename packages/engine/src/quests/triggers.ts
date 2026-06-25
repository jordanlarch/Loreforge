import { normalizeEntityQuests } from "./migrate";
import type { QuestTeaseTrigger, QuestTemplate, QuestTrigger } from "./types";

function matchesTeaseTrigger(
  trigger: QuestTrigger,
  event: QuestTeaseTrigger,
  locationEntityId: string,
  template: QuestTemplate,
): boolean {
  if (trigger.type !== event || trigger.delivery !== "tease") return false;

  const configLoc = trigger.config?.locationEntityId;
  if (configLoc && configLoc !== locationEntityId) return false;

  const startLoc = template.startingLocationEntityId;
  if (startLoc && startLoc !== locationEntityId) return false;

  return true;
}

function teaseBody(template: QuestTemplate): string | undefined {
  const text =
    template.teaseText?.trim() ||
    template.description?.trim() ||
    template.title.trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Resolve the first quest tease copy for a Live Play trigger event.
 * Deterministic — same entity data always yields the same tease.
 */
export function resolveQuestTeaseText(
  data: unknown,
  trigger: QuestTeaseTrigger,
  context: { locationEntityId: string },
): string | undefined {
  const quests = normalizeEntityQuests(data, context.locationEntityId);
  for (const template of quests) {
    const triggers = template.triggers ?? [];
    const hasMatchingTrigger =
      triggers.length === 0 ||
      triggers.some((t) =>
        matchesTeaseTrigger(t, trigger, context.locationEntityId, template),
      );
    if (!hasMatchingTrigger) continue;
    const body = teaseBody(template);
    if (body) return body;
  }
  return undefined;
}

/** Format tease copy for the opening GM line (Slice 3 / Phase A). */
export function formatQuestTeaseLine(tease: string): string {
  const trimmed = tease.trim();
  if (!trimmed) return "";
  const sentence = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return `Word reaches you: ${sentence} `;
}
