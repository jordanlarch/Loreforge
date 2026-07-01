/**
 * Gameplay Toolbox trap commands (GRILL-LIVE-TOOLBOX).
 * detect_trap / disable_trap / trigger_trap — deterministic checks and effects.
 */
import type { Condition } from "../combat/conditions";
import { adjustDamageAmount } from "../combat/damage";
import { getTrapDefinition } from "../content/srd-trap-seeds";
import type { TrapDefinition, TrapEffect } from "../content/toolbox-definitions";
import {
  abilityModifier,
  isCheckProficient,
  isSaveProficient,
  isToolProficient,
  saveRollTotal,
} from "../entities/abilities";
import type { EntityRef, SceneId, SceneTrapInstance } from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { RollMode } from "../rng/dice";
import type { ExecutionContext } from "./context";
import {
  reject,
  type CommandResult,
  type DetectTrapCommand,
  type DisableTrapCommand,
  type TriggerTrapCommand,
} from "./types";

type TrapHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function trapMeta(ctx: ExecutionContext, actor?: string): TrapHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

function findSceneTrap(
  ctx: ExecutionContext,
  sceneId: SceneId,
  trapInstanceId: string,
): { scene: NonNullable<(typeof ctx.world.scenes)[string]>; trap: SceneTrapInstance } | null {
  const scene = ctx.world.scenes[sceneId];
  if (!scene?.traps) return null;
  const trap = scene.traps.find((t) => t.instanceId === trapInstanceId);
  if (!trap) return null;
  return { scene, trap };
}

function rollCheck(
  ctx: ExecutionContext,
  entity: EntityRef,
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha",
  dc: number,
  proficient: boolean,
  scope: string,
  mode: RollMode = "normal",
): { events: DraftEvent[]; total: number; success: boolean } {
  const actor = ctx.world.entities[entity];
  if (!actor) {
    return { events: [], total: 0, success: false };
  }
  const roll = ctx.roll("1d20", scope, mode);
  const natural = roll.total;
  const profBonus = proficient ? actor.proficiencyBonus : 0;
  const total = natural + abilityModifier(actor.abilityScores[ability]) + profBonus;
  const success = total >= dc;
  return {
    events: [
      {
        type: "DiceRolled",
        ...trapMeta(ctx, entity),
        payload: {
          notation: roll.notation,
          rolls: roll.rolls,
          total: roll.total,
          scope: roll.scope,
          drawIndex: roll.drawIndex,
          mode,
        },
      },
      {
        type: "CheckRolled",
        ...trapMeta(ctx, entity),
        payload: {
          entity,
          ability,
          dc,
          mode,
          natural,
          total,
          success,
          proficient,
        },
      },
    ],
    total,
    success,
  };
}

function applyTrapEffectEvents(
  ctx: ExecutionContext,
  def: TrapDefinition,
  victim: EntityRef,
  effect: TrapEffect,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  const entity = ctx.world.entities[victim];
  if (!entity) return events;

  let damageMultiplier = 1;
  if (effect.save) {
    const saveRoll = ctx.roll(
      "1d20",
      `trap-save:${victim}:${effect.save.ability}`,
      "normal",
    );
    const natural = saveRoll.total;
    const total = saveRollTotal(entity, effect.save.ability, natural);
    const success = total >= effect.save.dc;
    const proficient = isSaveProficient(entity, effect.save.ability);
    events.push(
      {
        type: "DiceRolled",
        ...trapMeta(ctx, victim),
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
        ...trapMeta(ctx, victim),
        payload: {
          entity: victim,
          ability: effect.save.ability,
          dc: effect.save.dc,
          mode: "normal",
          natural,
          total,
          success,
          autoFail: false,
          proficient,
        },
      },
    );
    if (success) {
      if (effect.save.onSuccess === "negates") {
        return events;
      }
      if (effect.save.onSuccess === "half") {
        damageMultiplier = 0.5;
      }
    }
  }

  if (effect.damage?.length) {
    for (const chunk of effect.damage) {
      const dmgRoll = ctx.roll(chunk.dice, `trap-dmg:${victim}:${chunk.type}`, "normal");
      events.push({
        type: "DiceRolled",
        ...trapMeta(ctx, "system"),
        payload: {
          notation: dmgRoll.notation,
          rolls: dmgRoll.rolls,
          total: dmgRoll.total,
          scope: dmgRoll.scope,
          drawIndex: dmgRoll.drawIndex,
          mode: "normal",
        },
      });
      const amount = adjustDamageAmount(
        Math.floor(dmgRoll.total * damageMultiplier),
        chunk.type,
        entity,
      );
      if (amount > 0) {
        const fromTemp = Math.min(entity.hp.temp, amount);
        const toCurrent = amount - fromTemp;
        const hpAfter = Math.max(0, entity.hp.current - toCurrent);
        events.push({
          type: "DamageDealt",
          ...trapMeta(ctx, "system"),
          payload: {
            target: victim,
            amount,
            damageType: chunk.type,
            hpBefore: entity.hp.current,
            hpAfter,
          },
        });
      }
    }
  }

  if (effect.conditions?.length && damageMultiplier === 1) {
    for (const condition of effect.conditions) {
      events.push({
        type: "ConditionApplied",
        ...trapMeta(ctx, "system"),
        payload: {
          target: victim,
          condition: condition as Condition,
        },
      });
    }
  }

  return events;
}

function trapIsActive(trap: SceneTrapInstance, def: TrapDefinition): boolean {
  if (trap.disabled) return false;
  if (def.reset === "once" && trap.triggered) return false;
  return true;
}

export function handleDetectTrap(
  cmd: DetectTrapCommand,
  ctx: ExecutionContext,
): CommandResult {
  const actor = ctx.world.entities[cmd.entity];
  if (!actor) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const found = findSceneTrap(ctx, cmd.sceneId, cmd.trapInstanceId);
  if (!found) {
    return reject("TRAP_NOT_FOUND", `Trap ${cmd.trapInstanceId} not found on scene.`);
  }
  const def = getTrapDefinition(found.trap.trapSlug);
  if (!def?.detect) {
    return reject("TRAP_NO_DETECT", `${def?.name ?? found.trap.trapSlug} has no detect DC.`);
  }
  const proficient = isCheckProficient(actor, "Perception");
  const { events, success } = rollCheck(
    ctx,
    cmd.entity,
    def.detect.ability,
    def.detect.dc,
    proficient,
    `trap-detect:${cmd.trapInstanceId}`,
  );
  events.push({
    type: "TrapDetected",
    ...trapMeta(ctx, cmd.entity),
    payload: {
      sceneId: cmd.sceneId,
      trapInstanceId: cmd.trapInstanceId,
      trapSlug: found.trap.trapSlug,
      detector: cmd.entity,
      success,
    },
  });
  return {
    accepted: true,
    events,
    summary: { trapInstanceId: cmd.trapInstanceId, success },
  };
}

export function handleDisableTrap(
  cmd: DisableTrapCommand,
  ctx: ExecutionContext,
): CommandResult {
  const actor = ctx.world.entities[cmd.entity];
  if (!actor) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const found = findSceneTrap(ctx, cmd.sceneId, cmd.trapInstanceId);
  if (!found) {
    return reject("TRAP_NOT_FOUND", `Trap ${cmd.trapInstanceId} not found on scene.`);
  }
  if (found.trap.disabled) {
    return reject("TRAP_ALREADY_DISABLED", "Trap is already disabled.");
  }
  const def = getTrapDefinition(found.trap.trapSlug);
  if (!def?.disable) {
    return reject("TRAP_NO_DISABLE", `${def?.name ?? found.trap.trapSlug} cannot be disabled.`);
  }
  const proficient = def.disable.tool
    ? isToolProficient(actor, def.disable.tool)
    : isCheckProficient(actor, undefined);
  const { events, success } = rollCheck(
    ctx,
    cmd.entity,
    def.disable.ability,
    def.disable.dc,
    proficient,
    `trap-disable:${cmd.trapInstanceId}`,
  );
  events.push({
    type: "TrapDisabled",
    ...trapMeta(ctx, cmd.entity),
    payload: {
      sceneId: cmd.sceneId,
      trapInstanceId: cmd.trapInstanceId,
      trapSlug: found.trap.trapSlug,
      disabler: cmd.entity,
      success,
    },
  });
  return {
    accepted: true,
    events,
    summary: { trapInstanceId: cmd.trapInstanceId, success },
  };
}

export function handleTriggerTrap(
  cmd: TriggerTrapCommand,
  ctx: ExecutionContext,
): CommandResult {
  const victim = ctx.world.entities[cmd.victim];
  if (!victim) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.victim} does not exist.`);
  }
  const found = findSceneTrap(ctx, cmd.sceneId, cmd.trapInstanceId);
  if (!found) {
    return reject("TRAP_NOT_FOUND", `Trap ${cmd.trapInstanceId} not found on scene.`);
  }
  const def = getTrapDefinition(found.trap.trapSlug);
  if (!def) {
    return reject("TRAP_NOT_FOUND", `Unknown trap slug ${found.trap.trapSlug}.`);
  }
  if (!trapIsActive(found.trap, def)) {
    return reject("TRAP_ALREADY_TRIGGERED", "Trap is disabled or already spent.");
  }

  const structured =
    Boolean(def.effect.save || def.effect.damage?.length || def.effect.conditions?.length);
  const events: DraftEvent[] = [];
  if (structured) {
    events.push(...applyTrapEffectEvents(ctx, def, cmd.victim, def.effect));
  }

  events.push({
    type: "TrapTriggered",
    ...trapMeta(ctx, cmd.victim),
    payload: {
      sceneId: cmd.sceneId,
      trapInstanceId: cmd.trapInstanceId,
      trapSlug: found.trap.trapSlug,
      victim: cmd.victim,
      resolved: structured,
    },
  });

  return {
    accepted: true,
    events,
    summary: {
      trapInstanceId: cmd.trapInstanceId,
      victim: cmd.victim,
      resolved: structured,
    },
  };
}

/** After movement, auto-fire active traps on the destination cell (GRILL-LIVE-TOOLBOX Q4). */
export function trapTriggerEventsAfterMove(
  ctx: ExecutionContext,
  mover: EntityRef,
  sceneId: SceneId | undefined,
  to: { x: number; y: number },
): DraftEvent[] {
  if (!sceneId) return [];
  const scene = ctx.world.scenes[sceneId];
  if (!scene?.traps?.length) return [];

  const events: DraftEvent[] = [];
  for (const trap of scene.traps) {
    if (trap.position.x !== to.x || trap.position.y !== to.y) continue;
    const def = getTrapDefinition(trap.trapSlug);
    if (!def || !trapIsActive(trap, def)) continue;

    const result = handleTriggerTrap(
      {
        type: "trigger_trap",
        sceneId,
        trapInstanceId: trap.instanceId,
        victim: mover,
      },
      ctx,
    );
    if (result.accepted) {
      events.push(...result.events);
    }
  }
  return events;
}
