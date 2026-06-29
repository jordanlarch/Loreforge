/**
 * Gameplay Toolbox curse commands (GRILL-LIVE-CURSE).
 * apply_curse / resolve_curse_tick / remove_curse — deterministic saves and effects.
 */
import type { Condition } from "../combat/conditions";
import { abilityModifier } from "../entities/abilities";
import type { CurseDefinition } from "../content/toolbox-definitions";
import { getCurseDefinition } from "../content/srd-curse-seeds";
import type { ActiveCurseInstance, EntityRef } from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyCurseCommand,
  type CommandResult,
  type RemoveCurseCommand,
  type ResolveCurseTickCommand,
} from "./types";

type CurseHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function curseMeta(ctx: ExecutionContext, actor?: string): CurseHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

function makeInstanceId(target: EntityRef, slug: string, index: number): string {
  return `curse:${target}:${slug}:${index}`;
}

/** Turn-start recovery saves (Demonic Possession v1). */
export function curseNeedsRecoveryTick(def: CurseDefinition): boolean {
  const recovery = (def.recovery ?? "").toLowerCase();
  const effects = (def.effects ?? []).join(" ").toLowerCase();
  return (
    recovery.includes("each turn") ||
    recovery.includes("end of each later turn") ||
    effects.includes("end of each later turn")
  );
}

function shouldTrackActiveCurse(
  def: CurseDefinition,
  saveSuccess: boolean | undefined,
): boolean {
  if (saveSuccess && def.save?.onSuccess === "negates") return false;
  if (def.conditions?.length) return true;
  if (curseNeedsRecoveryTick(def)) return true;
  if (def.recovery?.trim() || def.effects?.length) return true;
  return false;
}

function applyCurseConditions(
  ctx: ExecutionContext,
  def: CurseDefinition,
  target: EntityRef,
): DraftEvent[] {
  if (!def.conditions?.length) return [];
  const events: DraftEvent[] = [];
  for (const condition of def.conditions) {
    events.push({
      type: "ConditionApplied",
      ...curseMeta(ctx, "system"),
      payload: {
        target,
        condition: condition as Condition,
      },
    });
  }
  return events;
}

function rollCurseSave(
  ctx: ExecutionContext,
  target: EntityRef,
  def: CurseDefinition,
  scope: string,
): { events: DraftEvent[]; success: boolean } {
  const entity = ctx.world.entities[target];
  if (!entity || !def.save) {
    return { events: [], success: true };
  }

  const saveRoll = ctx.roll("1d20", scope, "normal");
  const natural = saveRoll.total;
  const total = natural + abilityModifier(entity.abilityScores[def.save.ability]);
  const success = total >= def.save.dc;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...curseMeta(ctx, target),
      payload: {
        notation: saveRoll.notation,
        rolls: saveRoll.rolls,
        total: saveRoll.total,
        scope: saveRoll.scope,
        drawIndex: saveRoll.drawIndex,
        mode: "normal",
      },
    },
    {
      type: "SaveRolled",
      ...curseMeta(ctx, target),
      payload: {
        entity: target,
        ability: def.save.ability,
        dc: def.save.dc,
        mode: "normal",
        natural,
        total,
        success,
      },
    },
  ];

  return { events, success };
}

/** Core curse resolution — save, conditions, active instance. */
export function buildApplyCurseEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  curseSlug: string,
  opts?: { saveScope?: string; skipSave?: boolean },
): DraftEvent[] {
  const def = getCurseDefinition(curseSlug);
  if (!def) return [];

  const events: DraftEvent[] = [];
  let saveSuccess: boolean | undefined;

  if (def.save && !opts?.skipSave) {
    const save = rollCurseSave(
      ctx,
      target,
      def,
      opts?.saveScope ?? `curse-save:${target}:${curseSlug}`,
    );
    events.push(...save.events);
    saveSuccess = save.success;
    if (save.success && def.save.onSuccess === "negates") {
      return events;
    }
  }

  events.push(...applyCurseConditions(ctx, def, target));

  if (shouldTrackActiveCurse(def, saveSuccess)) {
    const existing = ctx.world.entities[target]?.activeCurses?.length ?? 0;
    const instanceId = makeInstanceId(target, curseSlug, existing);
    events.push({
      type: "CurseApplied",
      ...curseMeta(ctx, "system"),
      payload: {
        target,
        instanceId,
        curseSlug,
        pendingRecovery: curseNeedsRecoveryTick(def),
      },
    });
  }

  return events;
}

/** Remove every active curse on a target (Remove Curse spell). */
export function buildClearAllCursesEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  reason: "saved" | "removed" | "cured",
): DraftEvent[] {
  const entity = ctx.world.entities[target];
  if (!entity?.activeCurses?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of entity.activeCurses) {
    const def = getCurseDefinition(instance.curseSlug);
    events.push({
      type: "CurseRemoved",
      ...curseMeta(ctx, target),
      payload: {
        target,
        instanceId: instance.instanceId,
        curseSlug: instance.curseSlug,
        reason,
      },
    });
    if (def?.conditions?.length) {
      for (const condition of def.conditions) {
        events.push({
          type: "ConditionRemoved",
          ...curseMeta(ctx, target),
          payload: {
            target,
            condition: condition as Condition,
          },
        });
      }
    }
  }
  return events;
}

export function handleApplyCurse(
  cmd: ApplyCurseCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const def = getCurseDefinition(cmd.curseSlug);
  if (!def) {
    return reject("CURSE_NOT_FOUND", `Unknown curse slug ${cmd.curseSlug}.`);
  }
  if (def.contagion && !def.save && !def.conditions?.length) {
    return reject(
      "CURSE_DELIVERY_NOT_SUPPORTED",
      `${def.name} requires contagion spread — deferred to GRILL-EXPLORATION.`,
    );
  }
  if (target.activeCurses?.some((c) => c.curseSlug === cmd.curseSlug)) {
    return reject(
      "CURSE_ALREADY_ACTIVE",
      `${target.name} already has an active ${def.name} curse.`,
    );
  }

  const events = buildApplyCurseEvents(ctx, cmd.target, cmd.curseSlug);

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, curseSlug: cmd.curseSlug },
  };
}

export function handleRemoveCurse(
  cmd: RemoveCurseCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const instance = target.activeCurses?.find((c) => c.instanceId === cmd.instanceId);
  if (!instance) {
    return reject(
      "CURSE_NOT_ACTIVE",
      `No curse instance ${cmd.instanceId} on ${cmd.target}.`,
    );
  }
  const def = getCurseDefinition(instance.curseSlug);
  if (!def) {
    return reject("CURSE_NOT_FOUND", `Unknown curse slug ${instance.curseSlug}.`);
  }

  const events: DraftEvent[] = [
    {
      type: "CurseRemoved",
      ...curseMeta(ctx, cmd.target),
      payload: {
        target: cmd.target,
        instanceId: cmd.instanceId,
        curseSlug: instance.curseSlug,
        reason: "removed",
      },
    },
  ];

  if (def.conditions?.length) {
    for (const condition of def.conditions) {
      events.push({
        type: "ConditionRemoved",
        ...curseMeta(ctx, cmd.target),
        payload: {
          target: cmd.target,
          condition: condition as Condition,
        },
      });
    }
  }

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, instanceId: cmd.instanceId },
  };
}

function resolveDemonicPossessionTick(
  ctx: ExecutionContext,
  cmd: ResolveCurseTickCommand,
  instance: ActiveCurseInstance,
  def: CurseDefinition,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity || !def.save) {
    return reject("CURSE_NOT_ACTIVE", "Curse instance is no longer active.");
  }

  const events: DraftEvent[] = [];
  const save = rollCurseSave(
    ctx,
    cmd.entity,
    def,
    `curse-tick-save:${cmd.entity}:${instance.instanceId}`,
  );
  events.push(...save.events);

  if (save.success) {
    events.push({
      type: "CurseRemoved",
      ...curseMeta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        instanceId: instance.instanceId,
        curseSlug: instance.curseSlug,
        reason: "saved",
      },
    });
  }

  events.push({
    type: "CurseTickResolved",
    ...curseMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: instance.instanceId,
      curseSlug: instance.curseSlug,
      success: save.success,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: instance.instanceId, success: save.success },
  };
}

export function handleResolveCurseTick(
  cmd: ResolveCurseTickCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const instance = entity.activeCurses?.find((c) => c.instanceId === cmd.instanceId);
  if (!instance?.pendingRecovery) {
    return reject(
      "CURSE_NOT_ACTIVE",
      `No recovery-tracked curse instance ${cmd.instanceId} on ${cmd.entity}.`,
    );
  }
  const def = getCurseDefinition(instance.curseSlug);
  if (!def) {
    return reject("CURSE_NOT_FOUND", `Unknown curse slug ${instance.curseSlug}.`);
  }

  if (instance.curseSlug === "srd-2024_demonic-possession") {
    return resolveDemonicPossessionTick(ctx, cmd, instance, def);
  }

  return reject(
    "CURSE_NOT_ACTIVE",
    `Recovery tick for ${instance.curseSlug} is not implemented in v1.`,
  );
}

/** At turn start, auto-resolve recovery saves for the active combatant (Q4). */
export function curseTickEventsAfterTurnStart(
  ctx: ExecutionContext,
  entity: EntityRef,
): DraftEvent[] {
  const actor = ctx.world.entities[entity];
  if (!actor?.activeCurses?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of actor.activeCurses) {
    if (!instance.pendingRecovery) continue;
    const result = handleResolveCurseTick(
      {
        type: "resolve_curse_tick",
        entity,
        instanceId: instance.instanceId,
      },
      ctx,
    );
    if (result.accepted) {
      events.push(...result.events);
    }
  }
  return events;
}
