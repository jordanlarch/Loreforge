import type { QuestInstanceData } from "./instance";
import type { QuestStep, QuestTemplate } from "./types";

export type AdvanceStepInput = {
  /** Step being completed; defaults to `currentStepId`. */
  stepId?: string;
  /** When the current step has branches, pick this successor id. */
  branchStepId?: string;
};

export type AdvanceStepResult =
  | { ok: true; data: QuestInstanceData; completed: boolean }
  | { ok: false; reason: string };

function orderedSteps(template: QuestTemplate): QuestStep[] {
  return template.steps ?? [];
}

/** Resolve the next step id after completing `completedStepId`. */
export function resolveNextStepId(
  template: QuestTemplate,
  completedStepId: string,
  branchStepId?: string,
): string | undefined {
  const steps = orderedSteps(template);
  const index = steps.findIndex((s) => s.id === completedStepId);
  if (index < 0) return undefined;

  const step = steps[index]!;
  if (branchStepId) {
    const allowed = new Set([
      ...(step.nextStepId ? [step.nextStepId] : []),
      ...(step.alternateNextStepIds ?? []),
    ]);
    if (index + 1 < steps.length) {
      allowed.add(steps[index + 1]!.id);
    }
    if (allowed.has(branchStepId)) return branchStepId;
    return undefined;
  }

  if (step.nextStepId) return step.nextStepId;

  const alternates = step.alternateNextStepIds ?? [];
  if (alternates.length === 1) return alternates[0];
  if (alternates.length > 1) return undefined;

  if (index + 1 < steps.length) return steps[index + 1]!.id;
  return undefined;
}

/** Mark a step complete and advance `currentStepId` (Phase D). */
export function advanceQuestStep(
  data: QuestInstanceData,
  input: AdvanceStepInput = {},
): AdvanceStepResult {
  const template = data.templateSnapshot;
  if (!template) {
    return { ok: false, reason: "Quest has no template snapshot." };
  }

  const steps = orderedSteps(template);
  if (steps.length === 0) {
    return { ok: false, reason: "Quest has no steps." };
  }

  const stepId = input.stepId ?? data.currentStepId ?? steps[0]!.id;
  const step = steps.find((s) => s.id === stepId);
  if (!step) {
    return { ok: false, reason: "Step not found on this quest." };
  }

  const alternates = step.alternateNextStepIds ?? [];
  if (alternates.length > 1 && !input.branchStepId && !step.nextStepId) {
    return {
      ok: false,
      reason: "Choose which branch to follow before completing this step.",
    };
  }

  const nextId = resolveNextStepId(template, stepId, input.branchStepId);
  const completedStepIds = [...(data.completedStepIds ?? [])];
  if (!completedStepIds.includes(stepId)) {
    completedStepIds.push(stepId);
  }

  const allDone = steps.every(
    (s) => completedStepIds.includes(s.id) || s.id === stepId,
  );

  return {
    ok: true,
    data: {
      ...data,
      completedStepIds,
      currentStepId: nextId,
    },
    completed: allDone && nextId === undefined,
  };
}

/** Branch choices available when completing the current step. */
export function branchChoicesForStep(
  template: QuestTemplate,
  stepId: string,
): QuestStep[] {
  const step = (template.steps ?? []).find((s) => s.id === stepId);
  if (!step) return [];

  const ids = new Set<string>();
  if (step.nextStepId) ids.add(step.nextStepId);
  for (const id of step.alternateNextStepIds ?? []) ids.add(id);

  if (ids.size <= 1) return [];

  return (template.steps ?? []).filter((s) => ids.has(s.id));
}
