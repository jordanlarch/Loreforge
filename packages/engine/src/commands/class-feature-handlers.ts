/**
 * Live-play class feature spend — mirrors sheet `useClassFeature` on entity state.
 */
import { useClassFeature } from "../content/class-feature-actions";
import type { MonkFocusSpend } from "../content/class-feature-actions";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import type { CommandResult, UseClassFeatureCommand } from "./types";
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

function featurePoolSpentEvent(
  ctx: ExecutionContext,
  entityId: string,
  featureKey: string,
  resourceUses: boolean[],
): DraftEvent {
  return {
    type: "FeaturePoolSpent",
    ...meta(ctx, entityId),
    payload: { entity: entityId, featureKey, resourceUses },
  };
}

function requireOwnTurn(
  entityId: string,
  ctx: ExecutionContext,
): CommandResult | null {
  const encounter = ctx.world.encounter;
  const active = encounter?.order[encounter.activeIndex]?.entity;
  if (!encounter?.initiativeRolled || active !== entityId) {
    return reject(
      "ACTION_UNAVAILABLE",
      "You can only use class features on your turn.",
    );
  }
  return null;
}

export function handleUseClassFeature(
  cmd: UseClassFeatureCommand,
  ctx: ExecutionContext,
): CommandResult {
  const blocked = requireOwnTurn(cmd.entity, ctx);
  if (blocked) return blocked;

  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot use features while down.`);
  }
  if (!entity.classes?.length) {
    return reject("INVALID_PAYLOAD", "Entity has no class levels.");
  }

  let draw = 0;
  const result = useClassFeature({
    characterId: entity.id,
    classes: entity.classes,
    featureKey: cmd.featureKey,
    resourceUses: entity.resourceUses,
    currentHp: entity.hp.current,
    maxHp: entity.hp.max,
    rng: () => {
      draw += 1;
      const rolled = ctx.roll(
        "1d20",
        `feature:${entity.id}:${cmd.featureKey}:${draw}`,
      );
      return rolled.rolls[0] ?? 1;
    },
    beneficiaryId: cmd.beneficiaryId,
    monkFocusSpend: cmd.monkFocusSpend as MonkFocusSpend | undefined,
  });

  if (!result.ok) {
    return reject("INVALID_PAYLOAD", result.message);
  }

  const events: DraftEvent[] = [
    featurePoolSpentEvent(
      ctx,
      entity.id,
      result.featureKey,
      result.resourceUses[result.featureKey]!,
    ),
  ];

  if (result.kind === "heal" && result.healAmount != null && result.healAmount > 0) {
    const hpAfter = Math.min(entity.hp.max, entity.hp.current + result.healAmount);
    events.push({
      type: "HealingApplied",
      ...meta(ctx, entity.id),
      payload: {
        target: entity.id,
        amount: result.healAmount,
        hpBefore: entity.hp.current,
        hpAfter,
      },
    });
  }

  if (result.selfEffects?.length) {
    for (const effect of result.selfEffects) {
      events.push({
        type: "EffectApplied",
        ...meta(ctx, entity.id),
        payload: { target: entity.id, effect },
      });
    }
  }

  if (result.allyEffect) {
    events.push({
      type: "EffectApplied",
      ...meta(ctx, entity.id),
      payload: {
        target: result.allyEffect.target,
        effect: result.allyEffect.effect,
      },
    });
  }

  if (result.startDodging) {
    events.push({
      type: "DodgingStarted",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id },
    });
  }

  if (result.startDisengage) {
    events.push({
      type: "Disengaged",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id },
    });
  }

  if (result.bonusMovementFeet != null && result.bonusMovementFeet > 0) {
    events.push({
      type: "DashMovementGranted",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id, bonusFeet: result.bonusMovementFeet },
    });
  }

  return {
    accepted: true,
    events,
    summary: {
      entity: entity.id,
      featureKey: result.featureKey,
      kind: result.kind,
      message: result.message,
    },
  };
}
