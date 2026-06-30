/**
 * SRD-FID-21b subclass feature commands.
 */
import { resolveHit } from "../combat/attack";
import { entityReactionsSuppressed } from "../combat/effects";
import {
  bardicInspirationDie,
  classLevel,
  hasClassSubclass,
} from "../combat/class-feature-mechanics";
import { distanceFeet } from "../combat/grid";
import {
  featureResourceKey,
  remainingFeatureUses,
  spendFeatureUse,
} from "../entities/feature-resources";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import type { CommandResult, CuttingWordsCommand, FastHandsCommand } from "./types";
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

/** College of Lore — Cutting Words reaction. */
export function handleCuttingWords(
  cmd: CuttingWordsCommand,
  ctx: ExecutionContext,
): CommandResult {
  const reactor = ctx.world.entities[cmd.reactor];
  if (!reactor) {
    return reject("ACTOR_NOT_FOUND", `Reactor ${cmd.reactor} does not exist.`);
  }
  if (!reactor.alive) {
    return reject("TARGET_DEAD", `${reactor.name} cannot use Cutting Words while down.`);
  }
  if (!hasClassSubclass(reactor.classes, "Bard", "College of Lore")) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${reactor.name} does not have the College of Lore Cutting Words feature.`,
    );
  }
  if (classLevel(reactor.classes, "Bard") < 3) {
    return reject(
      "ACTION_UNAVAILABLE",
      "Cutting Words requires Bard level 3 or higher.",
    );
  }
  if (
    reactor.reaction !== undefined &&
    (reactor.reaction !== "available" || entityReactionsSuppressed(reactor))
  ) {
    return reject(
      "NO_REACTION",
      `${reactor.name} has no reaction available this round.`,
    );
  }

  const against = ctx.world.entities[cmd.against];
  if (!against) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.against} does not exist.`);
  }
  if (
    reactor.position &&
    against.position &&
    reactor.sceneId &&
    against.sceneId === reactor.sceneId &&
    distanceFeet(reactor.position, against.position) > 60
  ) {
    return reject(
      "OUT_OF_RANGE",
      `${against.name} is beyond Cutting Words range (60 ft).`,
    );
  }

  const biKey = featureResourceKey("Bard", 1, "bardic-inspiration");
  const bardLevel = classLevel(reactor.classes, "Bard");
  const poolSize = Math.max(0, reactor.proficiencyBonus);
  const remaining = remainingFeatureUses(reactor.resourceUses?.[biKey], poolSize);
  if (remaining < 1) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${reactor.name} has no Bardic Inspiration uses remaining.`,
    );
  }

  const die = bardicInspirationDie(bardLevel);
  const roll = ctx.roll(die, `cutting-words:${cmd.reactor}->${cmd.against}`);
  const penalty = Math.max(0, roll.total);
  const adjustedTotal = cmd.originalTotal - penalty;

  let hit: boolean | undefined;
  if (cmd.mode === "attack") {
    if (cmd.natural == null || cmd.targetAc == null) {
      return reject(
        "INVALID_PAYLOAD",
        "Cutting Words on an attack requires natural and targetAc.",
      );
    }
    hit = resolveHit(cmd.natural, adjustedTotal, cmd.targetAc).hit;
  }

  const spent = spendFeatureUse(reactor.resourceUses?.[biKey], poolSize);
  if (!spent) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${reactor.name} has no Bardic Inspiration uses remaining.`,
    );
  }
  const events: DraftEvent[] = [
    rollDiceEvent(ctx, roll),
    {
      type: "FeaturePoolSpent",
      ...meta(ctx, reactor.id),
      payload: {
        entity: reactor.id,
        featureKey: biKey,
        resourceUses: spent,
      },
    },
    {
      type: "ReactionTaken",
      ...meta(ctx, reactor.id),
      payload: { reactor: reactor.id, trigger: "cutting_words" },
    },
    {
      type: "CuttingWordsApplied",
      ...meta(ctx, reactor.id),
      payload: {
        reactor: reactor.id,
        against: against.id,
        mode: cmd.mode,
        die,
        penalty,
        originalTotal: cmd.originalTotal,
        adjustedTotal,
        ...(hit !== undefined ? { hit } : {}),
      },
    },
  ];

  return {
    accepted: true,
    events,
    summary: {
      reactor: reactor.id,
      against: against.id,
      penalty,
      adjustedTotal,
      ...(hit !== undefined ? { hit } : {}),
    },
  };
}

/** Thief — Fast Hands bonus-action interaction. */
export function handleFastHands(
  cmd: FastHandsCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot use Fast Hands while down.`);
  }
  if (!hasClassSubclass(entity.classes, "Rogue", "Thief")) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} does not have the Thief Fast Hands feature.`,
    );
  }
  if (classLevel(entity.classes, "Rogue") < 3) {
    return reject(
      "ACTION_UNAVAILABLE",
      "Fast Hands requires Rogue level 3 or higher.",
    );
  }
  const encounter = ctx.world.encounter;
  const active = encounter?.order[encounter.activeIndex]?.entity;
  if (encounter?.initiativeRolled && active !== entity.id) {
    return reject(
      "ACTION_UNAVAILABLE",
      `It is not ${entity.name}'s turn.`,
    );
  }
  const econ = entity.actionEconomy;
  if (econ && econ.bonusAction !== "available") {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} has already used its bonus action this turn.`,
    );
  }

  const events: DraftEvent[] = [
    {
      type: "FastHandsUsed",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id, action: cmd.action },
    },
  ];
  if (econ) {
    events.push({
      type: "ActionSpent",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id, bonusAction: true },
    });
  }

  return {
    accepted: true,
    events,
    summary: { entity: entity.id, action: cmd.action },
  };
}
