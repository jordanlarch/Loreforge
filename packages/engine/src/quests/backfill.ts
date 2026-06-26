import { createId } from "../id";
import { buildQuestInstanceDataFromTemplate } from "./instance";
import type { QuestTemplate } from "./types";

/** Build a minimal template snapshot from legacy title/summary-only rows. */
export function backfillTemplateFromLegacyRow(input: {
  title: string;
  summary: string;
  sourceEntityId?: string | null;
}): QuestTemplate {
  const title = input.title.trim() || "Untitled quest";
  const summary = input.summary.trim();
  return {
    id: createId(),
    title,
    description: summary || title,
    teaseText: summary || title,
    steps: [],
    source: "migrated",
    ...(input.sourceEntityId
      ? { startingLocationEntityId: input.sourceEntityId }
      : {}),
  };
}

/** Ensure instance `data` has a template snapshot (idempotent). */
export function backfillQuestInstanceData(
  data: unknown,
  row: { title: string; summary: string; sourceEntityId?: string | null },
): Record<string, unknown> {
  const base =
    typeof data === "object" && data !== null
      ? { ...(data as Record<string, unknown>) }
      : {};

  const snapshot = base.templateSnapshot;
  if (
    typeof snapshot === "object" &&
    snapshot !== null &&
    typeof (snapshot as QuestTemplate).title === "string"
  ) {
    return base;
  }

  const template = backfillTemplateFromLegacyRow(row);
  const filled = buildQuestInstanceDataFromTemplate(template);
  return {
    ...base,
    ...filled,
    acceptedAt:
      typeof base.acceptedAt === "string"
        ? base.acceptedAt
        : filled.acceptedAt,
  };
}
