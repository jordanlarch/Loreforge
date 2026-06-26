import type { QuestTemplate } from "./types";

/** Context for hard prerequisite gates (Phase D). */
export type QuestPrerequisiteContext = {
  /** Highest PC level in the campaign party (spec: highest-level PC). */
  partyMaxLevel: number;
  /** `sourceTemplateId` values for Resolved quest instances. */
  resolvedSourceTemplateIds: ReadonlySet<string>;
  /** `templateSnapshot.id` values for Resolved quest instances. */
  resolvedSnapshotTemplateIds: ReadonlySet<string>;
};

export type QuestPrerequisiteResult =
  | { met: true }
  | { met: false; reason: string };

/** Evaluate hard gates (`minLevel`, prerequisite quests). */
export function evaluateQuestPrerequisites(
  template: QuestTemplate,
  ctx: QuestPrerequisiteContext,
): QuestPrerequisiteResult {
  const minLevel = template.minLevel;
  if (minLevel != null && minLevel > 0 && ctx.partyMaxLevel < minLevel) {
    return {
      met: false,
      reason: `Requires a party member at level ${minLevel} or higher (current max: ${ctx.partyMaxLevel}).`,
    };
  }

  for (const reqId of template.prerequisiteQuestTemplateIds ?? []) {
    const trimmed = reqId.trim();
    if (!trimmed) continue;
    const done =
      ctx.resolvedSourceTemplateIds.has(trimmed) ||
      ctx.resolvedSnapshotTemplateIds.has(trimmed);
    if (!done) {
      return {
        met: false,
        reason: "Complete the prerequisite quest before accepting this one.",
      };
    }
  }

  return { met: true };
}
