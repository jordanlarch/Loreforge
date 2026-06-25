import {
  enrichEntityDataWithQuests,
  normalizeEntityQuests,
} from "./migrate";
import { resolveQuestTeaseText } from "./triggers";
import type { QuestTeaseTrigger } from "./types";

/** Whether entity `data` already has quest templates or legacy hooks. */
export function locationHasQuestContent(data: unknown): boolean {
  return normalizeEntityQuests(data).length > 0;
}

/**
 * Copy quest templates from a cascade parent (region/settlement) onto a child
 * location stub that has none, rebinding triggers to the child's entity id.
 */
export function inheritQuestDataFromParent(
  parentData: unknown,
  childEntityId: string,
  childData: Record<string, unknown> = {},
): Record<string, unknown> {
  if (locationHasQuestContent(childData)) return childData;
  const parentQuests = normalizeEntityQuests(parentData);
  if (parentQuests.length === 0) return childData;
  return enrichEntityDataWithQuests(
    { ...childData, quests: parentQuests },
    childEntityId,
  ) as Record<string, unknown>;
}

/**
 * Resolve tease copy from entity data, falling back to parent templates when the
 * location itself has no quests (Phase A.1 — cascade tavern stubs).
 */
export function resolveQuestTeaseTextWithInheritance(
  data: unknown,
  trigger: QuestTeaseTrigger,
  context: { locationEntityId: string },
  parentData?: unknown,
): string | undefined {
  const direct = resolveQuestTeaseText(data, trigger, context);
  if (direct) return direct;
  if (!parentData) return undefined;
  const inherited = inheritQuestDataFromParent(
    parentData,
    context.locationEntityId,
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {},
  );
  return resolveQuestTeaseText(inherited, trigger, context);
}
