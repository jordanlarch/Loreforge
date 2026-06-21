/**
 * Plot-hook lifecycle taxonomy + grouping (#59, Q7). Browser-safe so the Kanban
 * UI and the tRPC validator share one definition of the five lifecycle stages.
 */

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
