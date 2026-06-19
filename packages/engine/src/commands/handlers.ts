/**
 * Command handlers — validate then resolve a command into draft events.
 *
 * Each handler is a pure function of `(command, ctx)`. Validation failures
 * return a structured {@link CommandResult}; success returns the events to
 * append plus a compact summary (the summary is what gets fed back to the LLM
 * for narration — it never sees raw events). See `architecture.md` §4.4.
 */
import type { EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyDamageCommand,
  type ApplyHealingCommand,
  type ChangeSceneCommand,
  type Command,
  type CommandResult,
  type CreateEntityCommand,
  type CreateSceneCommand,
  type DamageSource,
  type MoveEntityCommand,
  type RollDiceCommand,
} from "./types";

function meta(ctx: ExecutionContext, actor?: string): Omit<EventMeta, "sequence"> {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor,
  };
}

/** Resolve a damage/healing source into a concrete amount (rolling if needed). */
function resolveAmount(
  source: DamageSource,
  scope: string,
  ctx: ExecutionContext,
): { amount: number; rollEvent?: ReturnType<typeof rollDiceEvent> } {
  if ("amount" in source) {
    return { amount: Math.max(0, Math.floor(source.amount)) };
  }
  const outcome = ctx.roll(source.notation, scope);
  return {
    amount: Math.max(0, outcome.total),
    rollEvent: rollDiceEvent(ctx, outcome),
  };
}

function rollDiceEvent(
  ctx: ExecutionContext,
  outcome: { notation: string; rolls: number[]; total: number; scope: string; drawIndex: number },
) {
  return {
    type: "DiceRolled" as const,
    ...meta(ctx),
    payload: {
      notation: outcome.notation,
      rolls: outcome.rolls,
      total: outcome.total,
      scope: outcome.scope,
      drawIndex: outcome.drawIndex,
    },
  };
}

function handleCreateScene(
  cmd: CreateSceneCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.scenes[cmd.scene.id]) {
    return reject("DUPLICATE_SCENE", `Scene ${cmd.scene.id} already exists.`);
  }
  return {
    accepted: true,
    events: [{ type: "SceneCreated", ...meta(ctx, "system"), payload: { scene: cmd.scene } }],
    summary: { sceneId: cmd.scene.id },
  };
}

function handleChangeScene(
  cmd: ChangeSceneCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (!ctx.world.scenes[cmd.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.sceneId} does not exist.`);
  }
  return {
    accepted: true,
    events: [{ type: "SceneChanged", ...meta(ctx, "system"), payload: { sceneId: cmd.sceneId } }],
    summary: { sceneId: cmd.sceneId },
  };
}

function handleCreateEntity(
  cmd: CreateEntityCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.entities[cmd.entity.id]) {
    return reject("DUPLICATE_ENTITY", `Entity ${cmd.entity.id} already exists.`);
  }
  if (cmd.entity.sceneId && !ctx.world.scenes[cmd.entity.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.entity.sceneId} does not exist.`);
  }
  return {
    accepted: true,
    events: [{ type: "EntityCreated", ...meta(ctx, "system"), payload: { entity: cmd.entity } }],
    summary: { entityId: cmd.entity.id, kind: cmd.entity.kind },
  };
}

function handleRollDice(
  cmd: RollDiceCommand,
  ctx: ExecutionContext,
): CommandResult {
  const scope = cmd.scope ?? "default";
  const outcome = ctx.roll(cmd.notation, scope, cmd.mode);
  return {
    accepted: true,
    events: [rollDiceEvent(ctx, outcome)],
    summary: {
      notation: cmd.notation,
      rolls: outcome.rolls,
      total: outcome.total,
      mode: cmd.mode ?? "normal",
    },
  };
}

function handleApplyDamage(
  cmd: ApplyDamageCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  const scope = cmd.scope ?? `damage:${cmd.target}`;
  const { amount, rollEvent } = resolveAmount(cmd.source, scope, ctx);

  const fromTemp = Math.min(target.hp.temp, amount);
  const toCurrent = amount - fromTemp;
  const hpAfter = Math.max(0, target.hp.current - toCurrent);

  const events = [
    ...(rollEvent ? [rollEvent] : []),
    {
      type: "DamageDealt" as const,
      ...meta(ctx),
      payload: {
        target: cmd.target,
        amount,
        damageType: cmd.damageType,
        hpBefore: target.hp.current,
        hpAfter,
      },
    },
  ];

  return {
    accepted: true,
    events,
    summary: {
      target: cmd.target,
      amount,
      damageType: cmd.damageType,
      hpAfter,
      downed: hpAfter <= 0,
    },
  };
}

function handleApplyHealing(
  cmd: ApplyHealingCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (!target.alive) {
    return reject("TARGET_DEAD", `${target.name} is dead and cannot be healed.`);
  }
  const scope = cmd.scope ?? `heal:${cmd.target}`;
  const { amount, rollEvent } = resolveAmount(cmd.source, scope, ctx);
  const hpAfter = Math.min(target.hp.max, target.hp.current + amount);

  const events = [
    ...(rollEvent ? [rollEvent] : []),
    {
      type: "HealingApplied" as const,
      ...meta(ctx),
      payload: {
        target: cmd.target,
        amount,
        hpBefore: target.hp.current,
        hpAfter,
      },
    },
  ];

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, amount, hpAfter },
  };
}

function handleMoveEntity(
  cmd: MoveEntityCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot move while dead.`);
  }
  return {
    accepted: true,
    events: [
      {
        type: "EntityMoved",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity, from: entity.position, to: cmd.to },
      },
    ],
    summary: { entity: cmd.entity, to: cmd.to },
  };
}

/** Dispatch a command to its handler. */
export function handleCommand(
  command: Command,
  ctx: ExecutionContext,
): CommandResult {
  switch (command.type) {
    case "create_scene":
      return handleCreateScene(command, ctx);
    case "change_scene":
      return handleChangeScene(command, ctx);
    case "create_entity":
      return handleCreateEntity(command, ctx);
    case "roll_dice":
      return handleRollDice(command, ctx);
    case "apply_damage":
      return handleApplyDamage(command, ctx);
    case "apply_healing":
      return handleApplyHealing(command, ctx);
    case "move_entity":
      return handleMoveEntity(command, ctx);
  }
}
