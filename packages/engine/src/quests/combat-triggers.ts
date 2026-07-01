import { advanceQuestStep } from "./steps";
import {
  parseQuestInstanceData,
  templateFromInstance,
  type QuestInstanceRef,
} from "./instance";
import { formatQuestBriefingLine } from "./runtime";
import type { QuestTemplate } from "./types";

function currentStep(template: QuestTemplate, stepId?: string) {
  const steps = template.steps ?? [];
  if (steps.length === 0) return undefined;
  return steps.find((s) => s.id === stepId) ?? steps[0];
}

/** Whether the active step should auto-complete when combat ends victoriously. */
export function stepEligibleForCombatEndAdvance(
  template: QuestTemplate,
  currentStepId?: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.encounterRef?.trim()) return true;
  if ((template.tags ?? []).includes("combat")) return true;
  return (template.triggers ?? []).some((t) => t.type === "on_combat_end");
}

export type QuestCombatAdvance = {
  instanceId: string;
  line: string;
  data: Record<string, unknown>;
  status: "active" | "resolved";
};

/**
 * After a victorious combat, advance active quests whose current step expects
 * `on_combat_end` / encounter completion.
 */
export function resolveQuestAdvancesOnCombatEnd(
  instances: readonly QuestInstanceRef[],
): QuestCombatAdvance[] {
  const advances: QuestCombatAdvance[] = [];

  for (const instance of instances) {
    if (instance.status !== "active") continue;
    const parsed = parseQuestInstanceData(instance.data);
    const template = parsed.templateSnapshot ?? templateFromInstance(instance);
    if (!template) continue;
    if (!stepEligibleForCombatEndAdvance(template, parsed.currentStepId)) {
      continue;
    }

    const result = advanceQuestStep(parsed);
    if (!result.ok) continue;

    const nextStepId = result.data.currentStepId;
    const line = result.completed
      ? `Quest complete — ${template.title}. Well done.`
      : formatQuestBriefingLine(template, nextStepId);

    advances.push({
      instanceId: instance.id,
      line,
      data: result.data as Record<string, unknown>,
      status: result.completed ? "resolved" : "active",
    });
  }

  return advances;
}
