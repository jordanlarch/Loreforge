/**
 * Deterministic class-feature actions (CHAR-7b) — Second Wind heal, etc.
 * Sheet "Use" and Live Play share this registry; engine owns the math.
 */
import { classFeaturesForLevel } from "../entities/class-features";
import {
  parseFeatureResourceKey,
  remainingFeatureUses,
  spendFeatureUse,
} from "../entities/feature-resources";
import type { ClassLevel } from "../entities/types";
import { rollDice, type DiceRoll } from "../rng/dice";
import type { Rng } from "../rng/prng";

export type ClassFeatureActionKind = "heal" | "extra_action";

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

export type FeatureUseResult = {
  ok: true;
  featureKey: string;
  featureId: string;
  kind: ClassFeatureActionKind;
  resourceUses: Record<string, boolean[]>;
  healAmount?: number;
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

  return {
    ok: true,
    featureKey: input.featureKey,
    featureId,
    kind: "extra_action",
    resourceUses: nextUses,
    message: "Action Surge spent — you gain one additional action on your turn.",
  };
}
