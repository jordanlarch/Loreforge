/**
 * Gameplay Toolbox fear/stress commands (GRILL-LIVE-FEAR).
 * apply_fear_stress / resolve_fear_stress_tick / remove_fear_stress
 */
import type { Condition } from "../combat/conditions";
import { isSaveProficient, saveRollTotal } from "../entities/abilities";
import type { FearStressDefinition } from "../content/toolbox-definitions";
import {
  fearStressAppliesFrightened,
  fearStressNeedsRepeatTick,
  fearStressPsychicDamage,
  getFearStressDefinition,
  isProlongedFearStressSlug,
} from "../content/srd-fear-stress-seeds";
import type {
  ActiveFearStressInstance,
  EntityRef,
  SceneId,
} from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyFearStressCommand,
  type CommandResult,
  type RemoveFearStressCommand,
  type ResolveFearStressTickCommand,
} from "./types";

type FearStressHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function fearStressMeta(
  ctx: ExecutionContext,
  actor?: string,
): FearStressHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

function makeInstanceId(target: EntityRef, slug: string, index: number): string {
  return `fear:${target}:${slug}:${index}`;
}

function rollFearStressSave(
  ctx: ExecutionContext,
  target: EntityRef,
  def: FearStressDefinition,
  scope: string,
): { events: DraftEvent[]; success: boolean } {
  const entity = ctx.world.entities[target];
  if (!entity || !def.save) {
    return { events: [], success: true };
  }

  const saveRoll = ctx.roll("1d20", scope, "normal");
  const natural = saveRoll.total;
  const total = saveRollTotal(entity, def.save.ability, natural);
  const success = total >= def.save.dc;
  const proficient = isSaveProficient(entity, def.save.ability);
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...fearStressMeta(ctx, target),
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
      ...fearStressMeta(ctx, target),
      payload: {
        entity: target,
        ability: def.save.ability,
        dc: def.save.dc,
        mode: "normal",
        natural,
        total,
        success,
        autoFail: false,
        proficient,
      },
    },
  ];

  return { events, success };
}

function applyPsychicDamage(
  ctx: ExecutionContext,
  target: EntityRef,
  dice: string,
  scope: string,
  multiplier: 1 | 0.5,
): DraftEvent[] {
  const entity = ctx.world.entities[target];
  if (!entity?.hp) return [];

  const dmgRoll = ctx.roll(dice, scope, "normal");
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...fearStressMeta(ctx, "system"),
      payload: {
        notation: dmgRoll.notation,
        rolls: dmgRoll.rolls,
        total: dmgRoll.total,
        scope: dmgRoll.scope,
        drawIndex: dmgRoll.drawIndex,
        mode: "normal",
      },
    },
  ];

  const amount = multiplier === 0.5 ? Math.floor(dmgRoll.total / 2) : dmgRoll.total;
  if (amount <= 0) return events;

  const fromTemp = Math.min(entity.hp.temp, amount);
  const toCurrent = amount - fromTemp;
  const hpAfter = Math.max(0, entity.hp.current - toCurrent);
  events.push({
    type: "DamageDealt",
    ...fearStressMeta(ctx, "system"),
    payload: {
      target,
      amount,
      damageType: "psychic",
      hpBefore: entity.hp.current,
      hpAfter,
    },
  });
  return events;
}

function applyFrightened(
  ctx: ExecutionContext,
  target: EntityRef,
): DraftEvent[] {
  return [
    {
      type: "ConditionApplied",
      ...fearStressMeta(ctx, "system"),
      payload: { target, condition: "frightened" as Condition },
    },
  ];
}

function removeFrightened(
  ctx: ExecutionContext,
  target: EntityRef,
): DraftEvent[] {
  return [
    {
      type: "ConditionRemoved",
      ...fearStressMeta(ctx, target),
      payload: { target, condition: "frightened" as Condition },
    },
  ];
}

/** Core fear/stress resolution — save, frightened or psychic damage, active instance. */
export function buildApplyFearStressEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  fearStressSlug: string,
  opts?: { saveScope?: string; skipSave?: boolean; boundSceneId?: SceneId },
): DraftEvent[] {
  const def = getFearStressDefinition(fearStressSlug);
  if (!def) return [];

  const events: DraftEvent[] = [];
  let saveSuccess: boolean | undefined;
  const isFear = fearStressAppliesFrightened(def);
  const psychic = fearStressPsychicDamage(def);

  if (def.save && !opts?.skipSave) {
    const save = rollFearStressSave(
      ctx,
      target,
      def,
      opts?.saveScope ?? `fear-save:${target}:${fearStressSlug}`,
    );
    events.push(...save.events);
    saveSuccess = save.success;

    if (save.success && def.save.onSuccess === "negates" && isFear) {
      return events;
    }
  }

  if (psychic) {
    if (saveSuccess && def.save?.onSuccess === "negates") {
      return events;
    }
    const multiplier =
      saveSuccess && def.save?.onSuccess === "half" ? 0.5 : 1;
    if (!saveSuccess || def.save?.onSuccess === "half") {
      events.push(
        ...applyPsychicDamage(
          ctx,
          target,
          psychic.dice,
          `fear-dmg:${target}:${fearStressSlug}`,
          multiplier,
        ),
      );
    }
    return events;
  }

  if (isFear) {
    if (saveSuccess && def.save?.onSuccess === "negates") {
      return events;
    }
    events.push(...applyFrightened(ctx, target));

    const existing = ctx.world.entities[target]?.activeFearStress?.length ?? 0;
    const instanceId = makeInstanceId(target, fearStressSlug, existing);
    events.push({
      type: "FearStressApplied",
      ...fearStressMeta(ctx, "system"),
      payload: {
        target,
        instanceId,
        fearStressSlug,
        pendingRepeat: fearStressNeedsRepeatTick(def),
        boundSceneId: opts?.boundSceneId,
      },
    });
  }

  return events;
}

export function buildRemoveFearStressEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  instanceId: string,
  reason: "saved" | "removed",
): DraftEvent[] {
  const entity = ctx.world.entities[target];
  const instance = entity?.activeFearStress?.find((i) => i.instanceId === instanceId);
  if (!instance) return [];

  const def = getFearStressDefinition(instance.fearStressSlug);
  const events: DraftEvent[] = [
    {
      type: "FearStressRemoved",
      ...fearStressMeta(ctx, target),
      payload: {
        target,
        instanceId,
        fearStressSlug: instance.fearStressSlug,
        reason,
      },
    },
  ];

  if (def && fearStressAppliesFrightened(def)) {
    events.push(...removeFrightened(ctx, target));
  }

  return events;
}

/** Remove scene-bound instances when leaving a location (Q4 C1). */
export function buildLeaveSceneFearStressEvents(
  ctx: ExecutionContext,
  departingSceneId: SceneId,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  for (const entity of Object.values(ctx.world.entities)) {
    if (!entity.activeFearStress?.length) continue;
    for (const instance of entity.activeFearStress) {
      if (instance.boundSceneId !== departingSceneId) continue;
      events.push(
        ...buildRemoveFearStressEvents(
          ctx,
          entity.id,
          instance.instanceId,
          "removed",
        ),
      );
    }
  }
  return events;
}

export function handleApplyFearStress(
  cmd: ApplyFearStressCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const def = getFearStressDefinition(cmd.fearStressSlug);
  if (!def) {
    return reject(
      "FEAR_STRESS_NOT_FOUND",
      `Unknown fear/stress slug ${cmd.fearStressSlug}.`,
    );
  }
  if (isProlongedFearStressSlug(cmd.fearStressSlug)) {
    return reject(
      "FEAR_STRESS_DELIVERY_NOT_SUPPORTED",
      `${def.name} is prolonged mental stress — deferred from Live Play v1.`,
    );
  }
  if (
    fearStressAppliesFrightened(def) &&
    target.activeFearStress?.some((i) => i.fearStressSlug === cmd.fearStressSlug)
  ) {
    return reject(
      "FEAR_STRESS_ALREADY_ACTIVE",
      `${target.name} is already affected by ${def.name}.`,
    );
  }

  const events = buildApplyFearStressEvents(
    ctx,
    cmd.target,
    cmd.fearStressSlug,
    { boundSceneId: cmd.boundSceneId },
  );

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, fearStressSlug: cmd.fearStressSlug },
  };
}

export function handleRemoveFearStress(
  cmd: RemoveFearStressCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const instance = target.activeFearStress?.find(
    (i) => i.instanceId === cmd.instanceId,
  );
  if (!instance) {
    return reject(
      "FEAR_STRESS_NOT_ACTIVE",
      `No fear/stress instance ${cmd.instanceId} on ${cmd.target}.`,
    );
  }

  const events = buildRemoveFearStressEvents(
    ctx,
    cmd.target,
    cmd.instanceId,
    "removed",
  );

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, instanceId: cmd.instanceId },
  };
}

function resolveFearStressTick(
  ctx: ExecutionContext,
  cmd: ResolveFearStressTickCommand,
  instance: ActiveFearStressInstance,
  def: FearStressDefinition,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }

  const events: DraftEvent[] = [];
  let success = true;

  if (def.save) {
    const save = rollFearStressSave(
      ctx,
      cmd.entity,
      def,
      `fear-tick-save:${cmd.entity}:${instance.instanceId}`,
    );
    events.push(...save.events);
    success = save.success;
    if (success && def.save.onSuccess === "negates") {
      events.push(
        ...buildRemoveFearStressEvents(
          ctx,
          cmd.entity,
          instance.instanceId,
          "saved",
        ),
      );
    }
  }

  events.push({
    type: "FearStressTickResolved",
    ...fearStressMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: instance.instanceId,
      fearStressSlug: instance.fearStressSlug,
      success,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: instance.instanceId, success },
  };
}

export function handleResolveFearStressTick(
  cmd: ResolveFearStressTickCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const instance = entity.activeFearStress?.find(
    (i) => i.instanceId === cmd.instanceId,
  );
  if (!instance?.pendingRepeat) {
    return reject(
      "FEAR_STRESS_NOT_ACTIVE",
      `No repeat-tracked fear instance ${cmd.instanceId} on ${cmd.entity}.`,
    );
  }
  const def = getFearStressDefinition(instance.fearStressSlug);
  if (!def) {
    return reject(
      "FEAR_STRESS_NOT_FOUND",
      `Unknown fear/stress slug ${instance.fearStressSlug}.`,
    );
  }

  return resolveFearStressTick(ctx, cmd, instance, def);
}

/** At turn start, auto-resolve repeat saves for the active combatant (Q4 B2). */
export function fearStressTickEventsAfterTurnStart(
  ctx: ExecutionContext,
  entity: EntityRef,
): DraftEvent[] {
  const actor = ctx.world.entities[entity];
  if (!actor?.activeFearStress?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of actor.activeFearStress) {
    if (!instance.pendingRepeat) continue;
    const result = handleResolveFearStressTick(
      {
        type: "resolve_fear_stress_tick",
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
