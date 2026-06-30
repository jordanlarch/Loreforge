/**
 * Deterministic class-feature actions (CHAR-7b, SRD-FID-21) — Second Wind, Rage, etc.
 */
import {
  bardicInspirationDie,
  classLevel,
  rageDamageBonus,
} from "../combat/class-feature-mechanics";
import type { ActiveEffect } from "../combat/effects";
import { classFeaturesForLevel } from "../entities/class-features";
import {
  parseFeatureResourceKey,
  remainingFeatureUses,
  spendFeatureUse,
} from "../entities/feature-resources";
import type { ClassLevel, EntityRef } from "../entities/types";
import { rollDice, type DiceRoll } from "../rng/dice";
import type { Rng } from "../rng/prng";

export type ClassFeatureActionKind =
  | "heal"
  | "extra_action"
  | "rage"
  | "bardic_inspiration";

export type ClassFeatureActionDef = {
  kind: ClassFeatureActionKind;
  dice?: string;
  /** Add the advancing class's level to heal (Second Wind). */
  addClassLevel?: boolean;
};

/** Stable feature id → mechanical effect (matches class-features ids). */
export const CLASS_FEATURE_ACTIONS: Record<string, ClassFeatureActionDef> = {
  "second-wind": { kind: "heal", dice: "1d10", addClassLevel: true },
  "action-surge": { kind: "extra_action" },
  rage: { kind: "rage" },
  "bardic-inspiration": { kind: "bardic_inspiration" },
};

export function classFeatureAction(
  featureId: string,
): ClassFeatureActionDef | undefined {
  return CLASS_FEATURE_ACTIONS[featureId];
}

export function featureUseSeedStable(
  characterId: string,
  featureKey: string,
  useIndex: number,
): string {
  return `feature:${characterId}:${featureKey}:${useIndex}`;
}

export function resolveFeatureHeal(
  def: ClassFeatureActionDef,
  classLevel: number,
  rng: Rng,
): { amount: number; roll: DiceRoll } {
  const roll = rollDice(def.dice ?? "1d4", rng);
  const amount = roll.total + (def.addClassLevel ? classLevel : 0);
  return { amount, roll };
}

export function buildRageEffect(
  entityId: EntityRef,
  _barbarianLevel: number,
): ActiveEffect {
  return {
    id: `rage:${entityId}`,
    name: "Rage",
    source: entityId,
    modifier: {
      type: "damage_resistance",
      types: ["bludgeoning", "piercing", "slashing"],
    },
    remainingRounds: 10,
  };
}

export function buildRageDamageEffect(
  entityId: EntityRef,
  barbarianLevel: number,
): ActiveEffect {
  return {
    id: `rage-dmg:${entityId}`,
    name: "Rage Damage",
    source: entityId,
    modifier: {
      type: "rage_damage_bonus",
      amount: rageDamageBonus(barbarianLevel),
    },
    remainingRounds: 10,
  };
}

export function buildBardicInspirationEffect(
  beneficiaryId: EntityRef,
  granterId: EntityRef,
  bardLevel: number,
  effectId: string,
): ActiveEffect {
  return {
    id: effectId,
    name: "Bardic Inspiration",
    source: granterId,
    modifier: {
      type: "bardic_inspiration",
      die: bardicInspirationDie(bardLevel),
    },
    remainingRounds: 600,
  };
}

export type FeatureUseResult = {
  ok: true;
  featureKey: string;
  featureId: string;
  kind: ClassFeatureActionKind;
  resourceUses: Record<string, boolean[]>;
  healAmount?: number;
  /** Effects to apply to the user (Rage). */
  selfEffects?: ActiveEffect[];
  /** Effect to apply to an ally (Bardic Inspiration). */
  allyEffect?: { target: EntityRef; effect: ActiveEffect };
  message: string;
};

export type FeatureUseError = { ok: false; message: string };

export function useClassFeature(
  input: {
    characterId: string;
    classes: ClassLevel[];
    featureKey: string;
    resourceUses: Record<string, boolean[]> | undefined;
    currentHp: number;
    maxHp: number;
    rng: Rng;
    useIndex?: number;
    /** Ally receiving Bardic Inspiration. */
    beneficiaryId?: EntityRef;
  },
): FeatureUseResult | FeatureUseError {
  const parsed = parseFeatureResourceKey(input.featureKey);
  if (!parsed) {
    return { ok: false, message: "Invalid feature key." };
  }

  const { className, level, featureId } = parsed;
  const cl = input.classes.find((c) => c.class === className);
  if (!cl || cl.level < level) {
    return { ok: false, message: "Character does not have this feature." };
  }

  const feature = classFeaturesForLevel(className, level).find(
    (f) => f.id === featureId,
  );
  if (!feature?.uses) {
    return { ok: false, message: "This feature cannot be used from the sheet." };
  }

  const action = classFeatureAction(featureId);
  if (!action) {
    return { ok: false, message: "No mechanical effect wired for this feature yet." };
  }

  const remaining = remainingFeatureUses(
    input.resourceUses?.[input.featureKey],
    feature.uses,
  );
  if (remaining <= 0) {
    return { ok: false, message: "No uses remaining." };
  }

  const spent = spendFeatureUse(
    input.resourceUses?.[input.featureKey],
    feature.uses,
  );
  if (!spent) {
    return { ok: false, message: "No uses remaining." };
  }

  const nextUses = {
    ...(input.resourceUses ?? {}),
    [input.featureKey]: spent,
  };

  if (action.kind === "heal") {
    const { amount } = resolveFeatureHeal(action, cl.level, input.rng);
    const capped = Math.min(input.maxHp, input.currentHp + amount);
    const healed = capped - input.currentHp;
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind: "heal",
      resourceUses: nextUses,
      healAmount: healed,
      message: `Second Wind restores ${healed} HP (${amount} rolled, capped at max).`,
    };
  }

  if (action.kind === "rage") {
    const barLevel = classLevel(input.classes, "Barbarian");
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind: "rage",
      resourceUses: nextUses,
      selfEffects: [
        buildRageEffect(input.characterId, barLevel),
        buildRageDamageEffect(input.characterId, barLevel),
      ],
      message: `Rage activated (+${rageDamageBonus(barLevel)} damage, B/P/S resistance).`,
    };
  }

  if (action.kind === "bardic_inspiration") {
    if (!input.beneficiaryId) {
      return { ok: false, message: "Choose an ally for Bardic Inspiration." };
    }
    const bardLevel = classLevel(input.classes, "Bard");
    const die = bardicInspirationDie(bardLevel);
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind: "bardic_inspiration",
      resourceUses: nextUses,
      allyEffect: {
        target: input.beneficiaryId,
        effect: buildBardicInspirationEffect(
          input.beneficiaryId,
          input.characterId,
          bardLevel,
          `bi:${input.beneficiaryId}:${input.featureKey}`,
        ),
      },
      message: `Granted Bardic Inspiration (${die}) to ally.`,
    };
  }

  return {
    ok: true,
    featureKey: input.featureKey,
    featureId,
    kind: "extra_action",
    resourceUses: nextUses,
    message: "Action Surge spent — you gain one additional action on your turn.",
  };
}
