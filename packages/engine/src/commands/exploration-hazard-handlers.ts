/**
 * Playing the Game exploration hazard commands (GRILL-EXPLORATION Slice 2).
 * apply_fall_damage / apply_burning / extinguish_burning / resolve_burning_tick
 */
import type { Condition } from "../combat/conditions";
import { adjustDamageAmount } from "../combat/damage";
import { isSaveProficient, saveRollTotal } from "../entities/abilities";
import {
  BURNING_EXTINGUISH_DC,
  BURNING_SLUG,
  BURNING_TICK_DAMAGE,
  fallDamageNotation,
} from "../content/srd-exploration-hazard-seeds";
import type { EntityRef } from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyBurningCommand,
  type ApplyFallDamageCommand,
  type CommandResult,
  type ExtinguishBurningCommand,
  type ResolveBurningTickCommand,
} from "./types";

type HazardHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function hazardMeta(ctx: ExecutionContext, actor?: string): HazardHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

function makeBurningInstanceId(target: EntityRef, index: number): string {
  return `burn:${target}:${BURNING_SLUG}:${index}`;
}

function applyFireDamage(
  ctx: ExecutionContext,
  target: EntityRef,
  dice: string,
  scope: string,
): { events: DraftEvent[]; damage: number } {
  const entity = ctx.world.entities[target];
  if (!entity?.hp) return { events: [], damage: 0 };

  const dmgRoll = ctx.roll(dice, scope, "normal");
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...hazardMeta(ctx, "system"),
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

  const amount = adjustDamageAmount(dmgRoll.total, "fire", entity);
  if (amount > 0) {
    const toCurrent = Math.max(0, amount - Math.min(entity.hp.temp, amount));
    const hpAfter = Math.max(0, entity.hp.current - toCurrent);
    events.push({
      type: "DamageDealt",
      ...hazardMeta(ctx, "system"),
      payload: {
        target,
        amount,
        damageType: "fire",
        hpBefore: entity.hp.current,
        hpAfter,
      },
    });
  }

  return { events, damage: amount };
}

export function handleApplyFallDamage(
  cmd: ApplyFallDamageCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  if (!Number.isFinite(cmd.heightFt) || cmd.heightFt < 0) {
    return reject("INVALID_PAYLOAD", "heightFt must be a non-negative number.");
  }

  const notation = fallDamageNotation(cmd.heightFt);
  if (!notation) {
    return {
      accepted: true,
      events: [],
      summary: { target: cmd.target, heightFt: cmd.heightFt, damage: 0 },
    };
  }

  const dmgRoll = ctx.roll(notation, `fall:${cmd.target}:${cmd.heightFt}`, "normal");
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...hazardMeta(ctx, cmd.target),
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

  const amount = adjustDamageAmount(dmgRoll.total, "bludgeoning", target);
  if (amount > 0) {
    const toCurrent = Math.max(0, amount - Math.min(target.hp.temp, amount));
    const hpAfter = Math.max(0, target.hp.current - toCurrent);
    events.push({
      type: "DamageDealt",
      ...hazardMeta(ctx, "system"),
      payload: {
        target: cmd.target,
        amount,
        damageType: "bludgeoning",
        hpBefore: target.hp.current,
        hpAfter,
      },
    });
    events.push({
      type: "ConditionApplied",
      ...hazardMeta(ctx, "system"),
      payload: {
        target: cmd.target,
        condition: "prone" satisfies Condition,
      },
    });
  }

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, heightFt: cmd.heightFt, damage: amount },
  };
}

export function handleApplyBurning(
  cmd: ApplyBurningCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }

  const slug = cmd.burningSlug ?? BURNING_SLUG;
  if (slug !== BURNING_SLUG) {
    return reject("BURNING_NOT_FOUND", `Unknown burning slug ${slug}.`);
  }

  if (target.activeBurning?.some((b) => b.burningSlug === slug)) {
    return reject(
      "BURNING_ALREADY_ACTIVE",
      `${target.name ?? cmd.target} is already burning.`,
    );
  }

  const index = target.activeBurning?.length ?? 0;
  const instanceId = makeBurningInstanceId(cmd.target, index);
  const events: DraftEvent[] = [
    {
      type: "BurningApplied",
      ...hazardMeta(ctx, "system"),
      payload: {
        target: cmd.target,
        instanceId,
        burningSlug: slug,
        pendingRepeat: true,
      },
    },
  ];

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, instanceId, burningSlug: slug },
  };
}

export function handleExtinguishBurning(
  cmd: ExtinguishBurningCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }

  const instance = target.activeBurning?.find((b) => b.instanceId === cmd.instanceId);
  if (!instance) {
    return reject(
      "BURNING_NOT_ACTIVE",
      `No burning instance ${cmd.instanceId} on ${cmd.target}.`,
    );
  }

  const events: DraftEvent[] = [];

  if (cmd.method === "dex_save") {
    const saveRoll = ctx.roll("1d20", `burn-extinguish:${cmd.target}`, "normal");
    const natural = saveRoll.total;
    const total = saveRollTotal(target, "dex", natural);
    const success = total >= BURNING_EXTINGUISH_DC;
    const proficient = isSaveProficient(target, "dex");
    events.push(
      {
        type: "DiceRolled",
        ...hazardMeta(ctx, cmd.target),
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
        ...hazardMeta(ctx, cmd.target),
        payload: {
          entity: cmd.target,
          ability: "dex",
          dc: BURNING_EXTINGUISH_DC,
          mode: "normal",
          natural,
          total,
          success,
          autoFail: false,
          proficient,
        },
      },
    );
    if (!success) {
      return {
        accepted: true,
        events,
        summary: { target: cmd.target, instanceId: cmd.instanceId, extinguished: false },
      };
    }
  }

  events.push({
    type: "BurningRemoved",
    ...hazardMeta(ctx, cmd.target),
    payload: {
      target: cmd.target,
      instanceId: cmd.instanceId,
      burningSlug: instance.burningSlug,
      reason: cmd.method === "action" ? "action" : "saved",
    },
  });

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, instanceId: cmd.instanceId, extinguished: true },
  };
}

export function handleResolveBurningTick(
  cmd: ResolveBurningTickCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }

  const instance = entity.activeBurning?.find((b) => b.instanceId === cmd.instanceId);
  if (!instance?.pendingRepeat) {
    return reject(
      "BURNING_NOT_ACTIVE",
      `No active burning instance ${cmd.instanceId} on ${cmd.entity}.`,
    );
  }

  const { events: fireEvents, damage } = applyFireDamage(
    ctx,
    cmd.entity,
    BURNING_TICK_DAMAGE,
    `burn-tick:${cmd.entity}:${cmd.instanceId}`,
  );
  const events = [...fireEvents];

  events.push({
    type: "BurningTickResolved",
    ...hazardMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: cmd.instanceId,
      burningSlug: instance.burningSlug,
      damage,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: cmd.instanceId, damage },
  };
}

export function burningTickEventsAfterTurnStart(
  ctx: ExecutionContext,
  entity: EntityRef,
): DraftEvent[] {
  const actor = ctx.world.entities[entity];
  if (!actor?.activeBurning?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of actor.activeBurning) {
    if (!instance.pendingRepeat) continue;
    const result = handleResolveBurningTick(
      {
        type: "resolve_burning_tick",
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
