/**
 * Standard combat actions — Dash, Disengage, Dodge, Help, Hide (SRD-FID-14).
 */
import { abilityModifier } from "../entities/abilities";
import { distanceFeet } from "../combat/grid";
import { REACH_FEET } from "../combat/reactions";
import {
  checkMode,
  combineMode,
  exhaustionD20Penalty,
  isIncapacitated,
  type RollAdjust,
} from "../combat/conditions";
import { effectiveSpeedForEntity } from "../combat/effects";
import type { ActiveEffect } from "../combat/effects";
import type { DraftEvent, EventMeta } from "../events/types";
import type { RollMode } from "../rng/dice";
import type { ExecutionContext } from "./context";
import type {
  CommandResult,
  DashCommand,
  DisengageCommand,
  DodgeCommand,
  HelpCommand,
  HideCommand,
} from "./types";
import { reject } from "./types";

function meta(
  ctx: ExecutionContext,
  actor?: string,
): Omit<EventMeta, "sequence"> {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor,
  };
}

function rollDiceEvent(
  ctx: ExecutionContext,
  outcome: {
    notation: string;
    rolls: number[];
    total: number;
    scope: string;
    drawIndex: number;
  },
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

function requireOwnTurnAction(
  entityId: string,
  ctx: ExecutionContext,
): CommandResult | null {
  const entity = ctx.world.entities[entityId];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${entityId} does not exist.`);
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot act while down.`);
  }
  if (isIncapacitated(entity.conditions)) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} is incapacitated and cannot take actions.`,
    );
  }
  const encounter = ctx.world.encounter;
  const active = encounter?.order[encounter.activeIndex]?.entity;
  if (!encounter || active !== entityId) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} can only take this action on its own turn.`,
    );
  }
  if (entity.actionEconomy?.action !== "available") {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} has already used its action this turn.`,
    );
  }
  return null;
}

function spendActionEvents(
  ctx: ExecutionContext,
  entityId: string,
): DraftEvent[] {
  return [
    {
      type: "ActionSpent",
      ...meta(ctx, entityId),
      payload: { entity: entityId, action: true },
    },
  ];
}

function adjacent(
  ctx: ExecutionContext,
  a: string,
  b: string,
  maxFt = REACH_FEET,
): boolean {
  const ea = ctx.world.entities[a];
  const eb = ctx.world.entities[b];
  if (!ea?.position || !eb?.position || ea.sceneId !== eb.sceneId) {
    return false;
  }
  return distanceFeet(ea.position, eb.position) <= maxFt;
}

export function handleDash(cmd: DashCommand, ctx: ExecutionContext): CommandResult {
  const blocked = requireOwnTurnAction(cmd.entity, ctx);
  if (blocked) return blocked;
  const entity = ctx.world.entities[cmd.entity]!;
  const bonus = effectiveSpeedForEntity(entity);
  return {
    accepted: true,
    events: [
      ...spendActionEvents(ctx, cmd.entity),
      {
        type: "DashMovementGranted",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity, bonusFeet: bonus },
      },
    ],
    summary: { entity: cmd.entity, bonusMovement: bonus },
  };
}

export function handleDisengage(
  cmd: DisengageCommand,
  ctx: ExecutionContext,
): CommandResult {
  const blocked = requireOwnTurnAction(cmd.entity, ctx);
  if (blocked) return blocked;
  return {
    accepted: true,
    events: [
      ...spendActionEvents(ctx, cmd.entity),
      {
        type: "Disengaged",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity },
      },
    ],
    summary: { entity: cmd.entity, disengaged: true },
  };
}

export function handleDodge(cmd: DodgeCommand, ctx: ExecutionContext): CommandResult {
  const blocked = requireOwnTurnAction(cmd.entity, ctx);
  if (blocked) return blocked;
  return {
    accepted: true,
    events: [
      ...spendActionEvents(ctx, cmd.entity),
      {
        type: "DodgingStarted",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity },
      },
    ],
    summary: { entity: cmd.entity, dodging: true },
  };
}

export function handleHelp(cmd: HelpCommand, ctx: ExecutionContext): CommandResult {
  const blocked = requireOwnTurnAction(cmd.helper, ctx);
  if (blocked) return blocked;
  const helper = ctx.world.entities[cmd.helper]!;
  const beneficiary = ctx.world.entities[cmd.beneficiary];
  if (!beneficiary) {
    return reject(
      "TARGET_NOT_FOUND",
      `Beneficiary ${cmd.beneficiary} does not exist.`,
    );
  }
  if (cmd.beneficiary === cmd.helper) {
    return reject("INVALID_TARGET", "You can't Help yourself.");
  }
  if (!adjacent(ctx, cmd.helper, cmd.beneficiary)) {
    return reject(
      "NOT_ADJACENT",
      `${beneficiary.name} must be within reach to receive Help.`,
    );
  }
  if (cmd.mode === "attack") {
    if (!cmd.foe) {
      return reject("INVALID_PAYLOAD", "Help (attack) requires a foe target.");
    }
    const foe = ctx.world.entities[cmd.foe];
    if (!foe) {
      return reject("TARGET_NOT_FOUND", `Foe ${cmd.foe} does not exist.`);
    }
    if (!adjacent(ctx, cmd.helper, cmd.foe)) {
      return reject(
        "NOT_ADJACENT",
        `The foe must be within ${REACH_FEET} ft of ${helper.name} to be Helped against.`,
      );
    }
    const effect: ActiveEffect = {
      id: `help-attack:${cmd.helper}:${cmd.foe}:${ctx.commandId}`,
      name: "Helped",
      source: cmd.helper,
      modifier: { type: "help_attack", foe: cmd.foe, helper: cmd.helper },
      expiresStartOfTurn: cmd.beneficiary,
    };
    return {
      accepted: true,
      events: [
        ...spendActionEvents(ctx, cmd.helper),
        {
          type: "EffectApplied",
          ...meta(ctx, cmd.helper),
          payload: { target: cmd.beneficiary, effect },
        },
      ],
      summary: {
        helper: cmd.helper,
        beneficiary: cmd.beneficiary,
        foe: cmd.foe,
        mode: "attack",
      },
    };
  }
  const effect: ActiveEffect = {
    id: `help-check:${cmd.helper}:${ctx.commandId}`,
    name: "Helped",
    source: cmd.helper,
    modifier: { type: "help_check", helper: cmd.helper },
    expiresStartOfTurn: cmd.beneficiary,
  };
  return {
    accepted: true,
    events: [
      ...spendActionEvents(ctx, cmd.helper),
      {
        type: "EffectApplied",
        ...meta(ctx, cmd.helper),
        payload: { target: cmd.beneficiary, effect },
      },
    ],
    summary: {
      helper: cmd.helper,
      beneficiary: cmd.beneficiary,
      mode: "check",
    },
  };
}

export const HIDE_STEALTH_DC = 15;

export function handleHide(cmd: HideCommand, ctx: ExecutionContext): CommandResult {
  const blocked = requireOwnTurnAction(cmd.entity, ctx);
  if (blocked) return blocked;
  const entity = ctx.world.entities[cmd.entity]!;
  const dc = cmd.dc ?? HIDE_STEALTH_DC;
  const mode = combineMode(
    (cmd.mode ?? "normal") as RollAdjust,
    checkMode(entity.conditions),
  ) as RollMode;
  const roll = ctx.roll("1d20", `hide:${cmd.entity}`, mode);
  const natural = roll.total;
  const profBonus = cmd.proficient ? entity.proficiencyBonus : 0;
  const total =
    natural +
    abilityModifier(entity.abilityScores.dex) +
    profBonus -
    exhaustionD20Penalty(entity.conditions);
  const success = total >= dc;
  const events: DraftEvent[] = [
    ...spendActionEvents(ctx, cmd.entity),
    rollDiceEvent(ctx, roll),
    {
      type: "CheckRolled",
      ...meta(ctx, cmd.entity),
      payload: {
        entity: cmd.entity,
        ability: "dex",
        skill: "Stealth",
        dc,
        mode,
        natural,
        total,
        proficient: cmd.proficient ?? false,
        success,
      },
    },
  ];
  if (success) {
    events.push({
      type: "ConditionApplied",
      ...meta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        condition: "invisible",
        source: cmd.entity,
      },
    });
  }
  return {
    accepted: true,
    events,
    summary: {
      entity: cmd.entity,
      total,
      dc,
      success,
      hidden: success,
    },
  };
}
