/**
 * Plot-hook lifecycle taxonomy + grouping (#59, Q7). Browser-safe so the Kanban
 * UI and the tRPC validator share one definition of the five lifecycle stages.
 */

import { normalizeEntityQuests } from "@app/engine";

export const HOOK_STATUSES = [
  "suggested",
  "open",
  "active",
  "resolved",
  "abandoned",
] as const;

export type HookStatus = (typeof HOOK_STATUSES)[number];

export const HOOK_STATUS_LABEL: Record<HookStatus, string> = {
  suggested: "Suggested",
  open: "Open",
  active: "Active",
  resolved: "Resolved",
  abandoned: "Abandoned",
};

export function isHookStatus(value: unknown): value is HookStatus {
  return (
    typeof value === "string" &&
    (HOOK_STATUSES as readonly string[]).includes(value)
  );
}

/** Plot-hook strings embedded on a Realms entity (`data.hooks`). */
export function extractEntityHookTexts(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const hooks = (data as Record<string, unknown>).hooks;
  if (!Array.isArray(hooks)) return [];
  return hooks.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

export type AcceptedHookRef = {
  sourceEntityId: string | null;
  title: string;
  summary: string;
  sourceTemplateId?: string | null;
};

/** Whether a Realms-embedded hook was already promoted into the campaign. */
export function isRealmHookAccepted(
  entityId: string,
  hookText: string,
  accepted: readonly AcceptedHookRef[],
  templateId?: string,
): boolean {
  const trimmed = hookText.trim();
  const title = trimmed.slice(0, 200);
  return accepted.some(
    (hook) =>
      hook.sourceEntityId === entityId &&
      (templateId != null &&
      hook.sourceTemplateId != null &&
      hook.sourceTemplateId === templateId
        ? true
        : hook.title === title || hook.summary === trimmed),
  );
}

export type PendingRealmHook = {
  entityId: string;
  entityName: string;
  title: string;
  summary: string;
  templateId?: string;
};

/**
 * Realms hooks on campaign-linked entities that are not yet first-class plot
 * hooks (Q7 Suggested column auto-feed, CAMP-5 tracer).
 */
export function pendingRealmHooks(input: {
  worldEntityIds: readonly string[];
  entities: readonly { id: string; name: string; data: unknown }[];
  accepted: readonly AcceptedHookRef[];
}): PendingRealmHook[] {
  const worldIds = new Set(input.worldEntityIds);
  const pending: PendingRealmHook[] = [];

  for (const entity of input.entities) {
    if (!worldIds.has(entity.id)) continue;

    const quests = normalizeEntityQuests(entity.data, entity.id);
    if (quests.length > 0) {
      for (const quest of quests) {
        const summary =
          quest.teaseText?.trim() ||
          quest.description?.trim() ||
          quest.title.trim();
        if (
          isRealmHookAccepted(
            entity.id,
            summary,
            input.accepted,
            quest.id,
          )
        ) {
          continue;
        }
        pending.push({
          entityId: entity.id,
          entityName: entity.name,
          title: quest.title.slice(0, 200),
          summary,
          templateId: quest.id,
        });
      }
      continue;
    }

    for (const hookText of extractEntityHookTexts(entity.data)) {
      if (isRealmHookAccepted(entity.id, hookText, input.accepted)) continue;
      const trimmed = hookText.trim();
      pending.push({
        entityId: entity.id,
        entityName: entity.name,
        title: trimmed.slice(0, 200),
        summary: trimmed,
      });
    }
  }

  return pending;
}

/**
 * Map a timestamp to a 1-based session index by `endedAt` (approximate hook
 * timeline when explicit hook↔session links are deferred).
 */
export function sessionIndexForDate(
  sessions: readonly { endedAt: Date | string }[],
  date: Date | string,
): number | null {
  if (sessions.length === 0) return null;
  const t = new Date(date).getTime();
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
  );
  for (let i = 0; i < sorted.length; i += 1) {
    if (t <= new Date(sorted[i]!.endedAt).getTime()) return i + 1;
  }
  return sorted.length;
}

/**
 * Bucket hooks into the five Kanban columns, preserving input order within each
 * column. Returns a record keyed by every status (empty arrays included) so the
 * board always renders all five columns. Pure and unit-testable.
 */
export function groupHooksByStatus<T extends { status: string }>(
  hooks: readonly T[],
): Record<HookStatus, T[]> {
  const grouped = Object.fromEntries(
    HOOK_STATUSES.map((s) => [s, [] as T[]]),
  ) as Record<HookStatus, T[]>;
  for (const hook of hooks) {
    if (isHookStatus(hook.status)) grouped[hook.status].push(hook);
  }
  return grouped;
}
