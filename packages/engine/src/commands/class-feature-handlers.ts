/**
 * Live-play class feature spend — mirrors sheet `useClassFeature` on entity state.
 */
import { useClassFeature } from "../content/class-feature-actions";
import type {
  ChannelDivinitySpend,
  MonkFocusSpend,
} from "../content/class-feature-actions";
import {
  abilityModifier,
  saveProficiencyBonus,
} from "../entities/abilities";
import { classFeaturesForLevel } from "../entities/class-features";
import {
  effectiveFeaturePoolSize,
  parseFeatureResourceKey,
  remainingFeatureUses,
  spendFeatureUse,
} from "../entities/feature-resources";
import { classLevel } from "../combat/class-feature-mechanics";
import type { EntityState } from "../entities/types";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import type { CommandResult, UseClassFeatureCommand } from "./types";
import { reject } from "./types";

function rollDiceEvent(
  ctx: ExecutionContext,
  roll: { notation: string; rolls: number[]; total: number; scope: string; drawIndex: number },
): DraftEvent {
  return {
    type: "DiceRolled",
    ...meta(ctx),
    payload: {
      notation: roll.notation,
      rolls: roll.rolls,
      total: roll.total,
      scope: roll.scope,
      drawIndex: roll.drawIndex,
    },
  };
}

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

function rollWisdomSave(
  ctx: ExecutionContext,
  target: EntityState,
  dc: number,
  scope: string,
): { success: boolean; events: DraftEvent[] } {
  const d20 = ctx.roll("1d20", scope);
  const mod = abilityModifier(target.abilityScores.wis);
  const total = d20.total + mod;
  return {
    success: total >= dc,
    events: [
      {
        type: "DiceRolled",
        ...meta(ctx, target.id),
        payload: {
          notation: d20.notation,
          rolls: d20.rolls,
          total: d20.total,
          scope: d20.scope,
          drawIndex: d20.drawIndex,
        },
      },
      {
        type: "SaveRolled",
        ...meta(ctx, target.id),
        payload: {
          entity: target.id,
          ability: "wis",
          dc,
          mode: "normal",
          natural: d20.total,
          total,
          success: total >= dc,
          autoFail: false,
        },
      },
    ],
  };
}

export function handleUseClassFeature(
  cmd: UseClassFeatureCommand,
  ctx: ExecutionContext,
): CommandResult {
  const parsedKey = parseFeatureResourceKey(cmd.featureKey);
  const isIndomitable = parsedKey?.featureId === "indomitable";

  if (!isIndomitable) {
    const blocked = requireOwnTurn(cmd.entity, ctx);
    if (blocked) return blocked;
  }

  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.alive && !isIndomitable) {
    return reject("TARGET_DEAD", `${entity.name} cannot use features while down.`);
  }
  if (!entity.classes?.length) {
    return reject("INVALID_PAYLOAD", "Entity has no class levels.");
  }

  if (isIndomitable) {
    const pending = ctx.world.encounter?.pendingIndomitable;
    if (!pending || pending.entity !== cmd.entity) {
      return reject(
        "ACTION_UNAVAILABLE",
        "No failed save is waiting for Indomitable.",
      );
    }
    const fighterLevel = classLevel(entity.classes, "Fighter");
    const feat = classFeaturesForLevel("Fighter", 9).find(
      (f) => f.id === "indomitable",
    );
    if (!feat?.uses) {
      return reject("INVALID_PAYLOAD", "Indomitable is not available.");
    }
    const poolSize = effectiveFeaturePoolSize(
      cmd.featureKey,
      entity.classes,
      feat.uses,
    );
    const remaining = remainingFeatureUses(
      entity.resourceUses?.[cmd.featureKey],
      poolSize,
    );
    if (remaining <= 0) {
      return reject("ACTION_UNAVAILABLE", "No Indomitable uses remaining.");
    }
    const spent = spendFeatureUse(entity.resourceUses?.[cmd.featureKey], poolSize);
    if (!spent) {
      return reject("ACTION_UNAVAILABLE", "No Indomitable uses remaining.");
    }
    const roll = ctx.roll(
      "1d20",
      `indomitable:${cmd.entity}:${pending.ability}`,
    );
    const natural = roll.total;
    const total =
      natural +
      abilityModifier(entity.abilityScores[pending.ability]) +
      saveProficiencyBonus(entity, pending.ability) +
      fighterLevel;
    const success = total >= pending.dc;
    return {
      accepted: true,
      events: [
        {
          type: "FeaturePoolSpent",
          ...meta(ctx, entity.id),
          payload: {
            entity: entity.id,
            featureKey: cmd.featureKey,
            resourceUses: spent,
          },
        },
        rollDiceEvent(ctx, roll),
        {
          type: "SaveRolled",
          ...meta(ctx, entity.id),
          payload: {
            entity: entity.id,
            ability: pending.ability,
            dc: pending.dc,
            mode: "normal",
            natural,
            total,
            success,
            autoFail: false,
            proficient: entity.saveProficiencies.includes(pending.ability),
            indomitableReroll: true,
          },
        },
        {
          type: "PendingIndomitableResolved",
          ...meta(ctx, entity.id),
          payload: { entity: entity.id },
        },
      ],
      summary: {
        entity: entity.id,
        featureKey: cmd.featureKey,
        kind: "indomitable_reroll",
        total,
        success,
        message: success
          ? `Indomitable reroll succeeds (${total} vs DC ${pending.dc}).`
          : `Indomitable reroll still fails (${total} vs DC ${pending.dc}).`,
      },
    };
  }

  const beneficiary = cmd.beneficiaryId
    ? ctx.world.entities[cmd.beneficiaryId]
    : undefined;

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
    channelDivinitySpend: cmd.channelDivinitySpend as
      | ChannelDivinitySpend
      | undefined,
    layOnHandsHealAmount: cmd.layOnHandsHealAmount,
    layOnHandsPurify: cmd.layOnHandsPurify,
    rageFrenzy: cmd.rageFrenzy,
    beneficiaryMaxHp: beneficiary?.hp.max,
    beneficiaryCurrentHp: beneficiary?.hp.current,
    proficiencyBonus: entity.proficiencyBonus,
    abilityScores: entity.abilityScores,
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

  const healTargetId = result.healTarget ?? entity.id;
  const healTarget = ctx.world.entities[healTargetId];

  if (
    (result.kind === "heal" || result.kind === "lay_on_hands") &&
    result.healAmount != null &&
    result.healAmount > 0 &&
    healTarget
  ) {
    const hpAfter = Math.min(
      healTarget.hp.max,
      healTarget.hp.current + result.healAmount,
    );
    events.push({
      type: "HealingApplied",
      ...meta(ctx, entity.id),
      payload: {
        target: healTargetId,
        amount: result.healAmount,
        hpBefore: healTarget.hp.current,
        hpAfter,
      },
    });
  }

  if (result.removeCondition && healTarget) {
    events.push({
      type: "ConditionRemoved",
      ...meta(ctx, entity.id),
      payload: {
        target: healTargetId,
        condition: result.removeCondition,
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

  if (
    result.kind === "channel_divinity_turn_undead" &&
    result.healTarget &&
    result.channelDivinityDc != null
  ) {
    const undead = ctx.world.entities[result.healTarget];
    if (undead) {
      const save = rollWisdomSave(
        ctx,
        undead,
        result.channelDivinityDc,
        `turn-undead:${entity.id}->${undead.id}`,
      );
      events.push(...save.events);
      if (!save.success) {
        events.push({
          type: "ConditionApplied",
          ...meta(ctx, entity.id),
          payload: {
            target: undead.id,
            condition: "frightened",
            source: entity.id,
          },
        });
      }
    }
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

  if (result.bonusUnarmedAttacks != null && result.bonusUnarmedAttacks > 0) {
    events.push({
      type: "ActionSpent",
      ...meta(ctx, entity.id),
      payload: {
        entity: entity.id,
        bonusAction: true,
        flurryAttacksGranted: result.bonusUnarmedAttacks,
      },
    });
  }

  if (result.kind === "extra_action") {
    events.push({
      type: "ActionSurgeGranted",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id },
    });
  }

  if (result.kind === "heal" && result.featureId === "second-wind") {
    events.push({
      type: "ActionSpent",
      ...meta(ctx, entity.id),
      payload: { entity: entity.id, bonusAction: true },
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
