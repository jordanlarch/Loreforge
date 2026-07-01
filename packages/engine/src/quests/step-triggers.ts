import {
  parseQuestInstanceData,
  templateFromInstance,
  type QuestInstanceData,
  type QuestInstanceRef,
} from "./instance";
import { formatQuestBriefingLine } from "./runtime";
import { advanceQuestStep } from "./steps";
import type { QuestStep, QuestTemplate, QuestTrigger } from "./types";

function currentStep(template: QuestTemplate, stepId?: string) {
  const steps = template.steps ?? [];
  if (steps.length === 0) return undefined;
  return steps.find((s) => s.id === stepId) ?? steps[0];
}

function hasOnStepCompleteTrigger(
  template: QuestTemplate,
  predicate: (trigger: QuestTrigger) => boolean,
): boolean {
  return (template.triggers ?? []).some(
    (t) => t.type === "on_step_complete" && predicate(t),
  );
}

function zoneTargetMatches(
  step: QuestStep,
  dungeonEntityId: string,
  zoneId: string,
): boolean {
  if (step.zoneId !== zoneId) return false;
  if (step.dungeonEntityId && step.dungeonEntityId !== dungeonEntityId) {
    return false;
  }
  return true;
}

/** Whether the active step should auto-complete when combat ends victoriously. */
export function stepEligibleForCombatEndAdvance(
  template: QuestTemplate,
  currentStepId?: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.completionKind === "defeat_encounter") return true;
  if (step.encounterRef?.trim()) return true;
  if ((template.tags ?? []).includes("combat")) return true;
  return (template.triggers ?? []).some((t) => t.type === "on_combat_end");
}

/** Whether entering a location should auto-complete the active step. */
export function stepEligibleForLocationAdvance(
  template: QuestTemplate,
  locationEntityId: string,
): boolean {
  return hasOnStepCompleteTrigger(
    template,
    (t) => t.config?.locationEntityId === locationEntityId,
  );
}

/** Whether talking to an NPC should auto-complete the active step. */
export function stepEligibleForNpcAdvance(
  template: QuestTemplate,
  npcEntityId: string,
  currentStepId?: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (step?.completionKind === "talk_npc" && step.npcEntityId === npcEntityId) {
    return true;
  }
  return hasOnStepCompleteTrigger(
    template,
    (t) => t.config?.npcEntityId === npcEntityId,
  );
}

export function stepEligibleForEnterZoneAdvance(
  template: QuestTemplate,
  currentStepId: string | undefined,
  dungeonEntityId: string,
  zoneId: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.completionKind === "enter_zone") {
    return zoneTargetMatches(step, dungeonEntityId, zoneId);
  }
  return false;
}

export function stepEligibleForDiscoverZoneAdvance(
  template: QuestTemplate,
  currentStepId: string | undefined,
  dungeonEntityId: string,
  zoneId: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.completionKind === "discover_zone") {
    return zoneTargetMatches(step, dungeonEntityId, zoneId);
  }
  return false;
}

export function stepEligibleForInteractAdvance(
  template: QuestTemplate,
  currentStepId: string | undefined,
  dungeonEntityId: string,
  zoneId: string,
  objectId: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.completionKind !== "interact") return false;
  if (step.objectId !== objectId) return false;
  return zoneTargetMatches(step, dungeonEntityId, zoneId);
}

export function stepEligibleForDetectedInZoneAdvance(
  template: QuestTemplate,
  currentStepId: string | undefined,
  dungeonEntityId: string,
  zoneId: string,
): boolean {
  const step = currentStep(template, currentStepId);
  if (!step) return false;
  if (step.completionKind === "detected_in_zone") {
    return zoneTargetMatches(step, dungeonEntityId, zoneId);
  }
  return false;
}

export type QuestStepAdvance = {
  instanceId: string;
  line: string;
  data: Record<string, unknown>;
  status: "active" | "resolved";
};

/** @deprecated Use {@link QuestStepAdvance}. */
export type QuestCombatAdvance = QuestStepAdvance;

export type QuestAdvanceEvent =
  | { kind: "combat_end" }
  | { kind: "enter_location"; locationEntityId: string }
  | { kind: "talk_to_npc"; npcEntityId: string }
  | { kind: "enter_zone"; dungeonEntityId: string; zoneId: string }
  | { kind: "discover_zone"; dungeonEntityId: string; zoneId: string }
  | { kind: "interact_object"; dungeonEntityId: string; zoneId: string; objectId: string }
  | { kind: "detected_in_zone"; dungeonEntityId: string; zoneId: string };

function stepEligibleForEvent(
  template: QuestTemplate,
  currentStepId: string | undefined,
  event: QuestAdvanceEvent,
): boolean {
  switch (event.kind) {
    case "combat_end":
      return stepEligibleForCombatEndAdvance(template, currentStepId);
    case "enter_location":
      return stepEligibleForLocationAdvance(template, event.locationEntityId);
    case "talk_to_npc":
      return stepEligibleForNpcAdvance(
        template,
        event.npcEntityId,
        currentStepId,
      );
    case "enter_zone":
      return stepEligibleForEnterZoneAdvance(
        template,
        currentStepId,
        event.dungeonEntityId,
        event.zoneId,
      );
    case "discover_zone":
      return stepEligibleForDiscoverZoneAdvance(
        template,
        currentStepId,
        event.dungeonEntityId,
        event.zoneId,
      );
    case "interact_object":
      return stepEligibleForInteractAdvance(
        template,
        currentStepId,
        event.dungeonEntityId,
        event.zoneId,
        event.objectId,
      );
    case "detected_in_zone":
      return stepEligibleForDetectedInZoneAdvance(
        template,
        currentStepId,
        event.dungeonEntityId,
        event.zoneId,
      );
  }
}

function advanceActiveInstance(
  instance: QuestInstanceRef,
  event: QuestAdvanceEvent,
): QuestStepAdvance | undefined {
  if (instance.status !== "active") return undefined;
  const parsed = parseQuestInstanceData(instance.data);
  const template = parsed.templateSnapshot ?? templateFromInstance(instance);
  if (!template) return undefined;
  if (!stepEligibleForEvent(template, parsed.currentStepId, event)) {
    return undefined;
  }

  const result = advanceQuestStep(parsed);
  if (!result.ok) return undefined;

  const nextStepId = result.data.currentStepId;
  const line = result.completed
    ? `Quest complete — ${template.title}. Well done.`
    : formatQuestBriefingLine(template, nextStepId);

  return {
    instanceId: instance.id,
    line,
    data: result.data as Record<string, unknown>,
    status: result.completed ? "resolved" : "active",
  };
}

/** Deterministic step advances for a Live Play trigger event. */
export function resolveQuestAdvancesOnEvent(
  instances: readonly QuestInstanceRef[],
  event: QuestAdvanceEvent,
): QuestStepAdvance[] {
  const advances: QuestStepAdvance[] = [];
  for (const instance of instances) {
    const advance = advanceActiveInstance(instance, event);
    if (advance) advances.push(advance);
  }
  return advances;
}

/** After victorious combat, advance active quests whose current step expects combat end. */
export function resolveQuestAdvancesOnCombatEnd(
  instances: readonly QuestInstanceRef[],
): QuestStepAdvance[] {
  return resolveQuestAdvancesOnEvent(instances, { kind: "combat_end" });
}

export function resolveQuestAdvancesOnEnterZone(
  instances: readonly QuestInstanceRef[],
  dungeonEntityId: string,
  zoneId: string,
): QuestStepAdvance[] {
  return resolveQuestAdvancesOnEvent(instances, {
    kind: "enter_zone",
    dungeonEntityId,
    zoneId,
  });
}

export function resolveQuestAdvancesOnDiscoverZone(
  instances: readonly QuestInstanceRef[],
  dungeonEntityId: string,
  zoneId: string,
): QuestStepAdvance[] {
  return resolveQuestAdvancesOnEvent(instances, {
    kind: "discover_zone",
    dungeonEntityId,
    zoneId,
  });
}

export function resolveQuestAdvancesOnInteractObject(
  instances: readonly QuestInstanceRef[],
  dungeonEntityId: string,
  zoneId: string,
  objectId: string,
): QuestStepAdvance[] {
  return resolveQuestAdvancesOnEvent(instances, {
    kind: "interact_object",
    dungeonEntityId,
    zoneId,
    objectId,
  });
}

export function resolveQuestAdvancesOnDetectedInZone(
  instances: readonly QuestInstanceRef[],
  dungeonEntityId: string,
  zoneId: string,
): QuestStepAdvance[] {
  return resolveQuestAdvancesOnEvent(instances, {
    kind: "detected_in_zone",
    dungeonEntityId,
    zoneId,
  });
}

/** GM lines queued by Campaign Quest tab manual step completion. */
export function pendingStepAdvanceLines(
  instances: readonly QuestInstanceRef[],
): { instanceId: string; line: string }[] {
  const pending: { instanceId: string; line: string }[] = [];
  for (const instance of instances) {
    if (instance.status !== "active" && instance.status !== "resolved") {
      continue;
    }
    const parsed = parseQuestInstanceData(instance.data);
    if (parsed.stepAdvanceDelivered) continue;
    const line = parsed.pendingStepAdvanceLine?.trim();
    if (!line) continue;
    pending.push({ instanceId: instance.id, line });
  }
  return pending;
}

/** Mark a pending step-advance GM line as delivered in Live Play. */
export function markStepAdvanceDelivered(data: unknown): Record<string, unknown> {
  const base = typeof data === "object" && data !== null ? { ...data } : {};
  return {
    ...base,
    stepAdvanceDelivered: true,
    pendingStepAdvanceLine: undefined,
  };
}

/** Queue a GM line after manual step completion from the Campaign Quests tab. */
export function queueStepAdvanceLine(
  data: QuestInstanceData,
  line: string,
): Record<string, unknown> {
  return {
    ...data,
    pendingStepAdvanceLine: line,
    stepAdvanceDelivered: false,
  };
}
