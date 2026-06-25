import type { QuestTemplate } from "./types";

/** Campaign quest instance payload stored in `plot_hooks.data`. */
export type QuestInstanceData = {
  templateSnapshot?: QuestTemplate;
  currentStepId?: string;
  completedStepIds?: string[];
  briefingDelivered?: boolean;
  acceptedAt?: string;
  resolvedAt?: string;
  outcomeNotes?: string;
};

export type QuestInstanceStatus =
  | "suggested"
  | "open"
  | "active"
  | "resolved"
  | "abandoned";

/** Minimal campaign quest row shape for runtime evaluators. */
export type QuestInstanceRef = {
  id: string;
  status: QuestInstanceStatus | string;
  title: string;
  data: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parse quest instance jsonb from a campaign row. */
export function parseQuestInstanceData(data: unknown): QuestInstanceData {
  if (!isRecord(data)) return {};
  const snapshot = data.templateSnapshot;
  return {
    templateSnapshot:
      isRecord(snapshot) && typeof snapshot.title === "string"
        ? (snapshot as QuestTemplate)
        : undefined,
    currentStepId:
      typeof data.currentStepId === "string" ? data.currentStepId : undefined,
    completedStepIds: Array.isArray(data.completedStepIds)
      ? data.completedStepIds.filter((id): id is string => typeof id === "string")
      : [],
    briefingDelivered: data.briefingDelivered === true,
    acceptedAt:
      typeof data.acceptedAt === "string" ? data.acceptedAt : undefined,
    resolvedAt:
      typeof data.resolvedAt === "string" ? data.resolvedAt : undefined,
    outcomeNotes:
      typeof data.outcomeNotes === "string" ? data.outcomeNotes : undefined,
  };
}

/** Deep-clone a template for accept-time snapshotting. */
export function snapshotQuestTemplate(template: QuestTemplate): QuestTemplate {
  return structuredClone(template);
}

/** Build initial instance data when accepting a Realms template. */
export function buildQuestInstanceDataFromTemplate(
  template: QuestTemplate,
): QuestInstanceData {
  const snapshot = snapshotQuestTemplate(template);
  const firstStepId = snapshot.steps?.[0]?.id;
  return {
    templateSnapshot: snapshot,
    currentStepId: firstStepId,
    completedStepIds: [],
    briefingDelivered: false,
    acceptedAt: new Date().toISOString(),
  };
}

/** Resolve the template snapshot from an instance row (fallback to title-only stub). */
export function templateFromInstance(
  instance: QuestInstanceRef,
): QuestTemplate | undefined {
  const parsed = parseQuestInstanceData(instance.data);
  if (parsed.templateSnapshot) return parsed.templateSnapshot;
  return undefined;
}
