/**
 * Deterministic class-feature actions (CHAR-7b, SRD-FID-21) — Second Wind, Rage, etc.
 */
import {
  bardicInspirationDie,
  channelDivinitySaveDc,
  classLevel,
  hasClassSubclass,
  martialArtsDie,
  rageDamageBonus,
} from "../combat/class-feature-mechanics";
import type { ActiveEffect } from "../combat/effects";
import { abilityModifier } from "../entities/abilities";
import { classFeaturesForLevel } from "../entities/class-features";
import {
  effectiveFeaturePoolSize,
  parseFeatureResourceKey,
  remainingFeatureUses,
  spendFeaturePoolPoints,
  spendFeatureUse,
} from "../entities/feature-resources";
import type { ClassLevel, EntityRef, EntityState } from "../entities/types";
import { rollDice, type DiceRoll } from "../rng/dice";
import type { Rng } from "../rng/prng";

export type ClassFeatureActionKind =
  | "heal"
  | "extra_action"
  | "indomitable_reroll"
  | "rage"
  | "bardic_inspiration"
  | "monk_flurry"
  | "monk_patient_defense"
  | "monk_step_of_wind"
  | "lay_on_hands"
  | "channel_divinity_sense"
  | "channel_divinity_sacred_weapon"
  | "channel_divinity_turn_undead";

export type MonkFocusSpend = "flurry" | "patient_defense" | "step_of_wind";

export type ChannelDivinitySpend =
  | "divine_sense"
  | "sacred_weapon"
  | "turn_undead";

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
  indomitable: { kind: "indomitable_reroll" },
  rage: { kind: "rage" },
  "bardic-inspiration": { kind: "bardic_inspiration" },
  "monk-s-focus": { kind: "monk_flurry" },
  "lay-on-hands": { kind: "lay_on_hands" },
  "channel-divinity": { kind: "channel_divinity_sense" },
};

const CHANNEL_DIVINITY_KIND: Record<
  ChannelDivinitySpend,
  ClassFeatureActionKind
> = {
  divine_sense: "channel_divinity_sense",
  sacred_weapon: "channel_divinity_sacred_weapon",
  turn_undead: "channel_divinity_turn_undead",
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

export function buildFrenzyEffect(entityId: EntityRef): ActiveEffect {
  return {
    id: `frenzy:${entityId}`,
    name: "Frenzy",
    source: entityId,
    modifier: { type: "frenzy_active" },
    remainingRounds: 10,
  };
}

const MONK_FOCUS_KIND: Record<MonkFocusSpend, ClassFeatureActionKind> = {
  flurry: "monk_flurry",
  patient_defense: "monk_patient_defense",
  step_of_wind: "monk_step_of_wind",
};

export function buildSacredWeaponEffect(
  entityId: EntityRef,
  paladin: Pick<EntityState, "abilityScores">,
): ActiveEffect {
  const chaMod = Math.max(0, abilityModifier(paladin.abilityScores.cha));
  const dice = chaMod > 0 ? `1d1+${chaMod - 1}` : "1d1-1";
  return {
    id: `sacred-weapon:${entityId}`,
    name: "Sacred Weapon",
    source: entityId,
    modifier: { type: "attack_roll_bonus", dice },
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
  /** Bonus unarmed strikes granted (Flurry of Blows). */
  bonusUnarmedAttacks?: number;
  /** Unarmed damage die for Flurry strikes. */
  unarmedDamageDie?: string;
  /** Sheet/combat flags to apply after spend. */
  startDodging?: boolean;
  startDisengage?: boolean;
  bonusMovementFeet?: number;
  /** Entity receiving Lay on Hands healing. */
  healTarget?: EntityRef;
  /** Condition removed by Lay on Hands purification. */
  removeCondition?: "poisoned";
  /** Save DC for Channel Divinity Turn Undead. */
  channelDivinityDc?: number;
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
    /** Ally receiving Bardic Inspiration or Lay on Hands. */
    beneficiaryId?: EntityRef;
    /** Monk's Focus spend — Flurry, Patient Defense, or Step of the Wind. */
    monkFocusSpend?: MonkFocusSpend;
    /** Channel Divinity option. */
    channelDivinitySpend?: ChannelDivinitySpend;
    /** Lay on Hands HP to spend on a touch heal. */
    layOnHandsHealAmount?: number;
    /** Lay on Hands — spend 5 HP from the pool to end Poisoned. */
    layOnHandsPurify?: boolean;
    /** Path of the Berserker — enter Frenzy when Raging. */
    rageFrenzy?: boolean;
    /** Beneficiary max/current HP for Lay on Hands (defaults to self). */
    beneficiaryMaxHp?: number;
    beneficiaryCurrentHp?: number;
    proficiencyBonus?: number;
    abilityScores?: EntityState["abilityScores"];
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

  const poolSize = effectiveFeaturePoolSize(
    input.featureKey,
    input.classes,
    feature.uses,
  );

  if (featureId === "monk-s-focus") {
    if (!input.monkFocusSpend) {
      return {
        ok: false,
        message: "Choose a Focus ability: Flurry, Patient Defense, or Step of the Wind.",
      };
    }
  } else if (featureId === "channel-divinity") {
    if (!input.channelDivinitySpend) {
      return {
        ok: false,
        message: "Choose a Channel Divinity option: Divine Sense, Sacred Weapon, or Turn Undead.",
      };
    }
  } else if (featureId !== "lay-on-hands") {
    const action = classFeatureAction(featureId);
    if (!action) {
      return {
        ok: false,
        message: "No mechanical effect wired for this feature yet.",
      };
    }
  }

  let nextUses: Record<string, boolean[]>;

  if (featureId === "lay-on-hands") {
    const points = input.layOnHandsPurify ? 5 : input.layOnHandsHealAmount ?? 0;
    if (points <= 0) {
      return {
        ok: false,
        message: "Specify how many Lay on Hands HP to spend, or purify Poisoned (5 HP).",
      };
    }
    const spent = spendFeaturePoolPoints(
      input.resourceUses?.[input.featureKey],
      poolSize,
      points,
    );
    if (!spent) {
      return { ok: false, message: "Not enough Lay on Hands HP remaining." };
    }
    nextUses = {
      ...(input.resourceUses ?? {}),
      [input.featureKey]: spent,
    };
    const healTarget = input.beneficiaryId ?? input.characterId;
    if (input.layOnHandsPurify) {
      return {
        ok: true,
        featureKey: input.featureKey,
        featureId,
        kind: "lay_on_hands",
        resourceUses: nextUses,
        healTarget,
        removeCondition: "poisoned",
        message: "Lay on Hands — spent 5 HP to end Poisoned.",
      };
    }
    const targetMax = input.beneficiaryMaxHp ?? input.maxHp;
    const targetCurrent = input.beneficiaryCurrentHp ?? input.currentHp;
    const capped = Math.min(targetMax, targetCurrent + points);
    const healed = capped - targetCurrent;
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind: "lay_on_hands",
      resourceUses: nextUses,
      healTarget,
      healAmount: healed,
      message: `Lay on Hands restores ${healed} HP (${points} spent from pool).`,
    };
  }

  const remaining = remainingFeatureUses(
    input.resourceUses?.[input.featureKey],
    poolSize,
  );
  if (remaining <= 0) {
    return { ok: false, message: "No uses remaining." };
  }

  const spent = spendFeatureUse(
    input.resourceUses?.[input.featureKey],
    poolSize,
  );
  if (!spent) {
    return { ok: false, message: "No uses remaining." };
  }

  nextUses = {
    ...(input.resourceUses ?? {}),
    [input.featureKey]: spent,
  };

  if (featureId === "channel-divinity" && input.channelDivinitySpend) {
    const kind = CHANNEL_DIVINITY_KIND[input.channelDivinitySpend];
    if (input.channelDivinitySpend === "divine_sense") {
      return {
        ok: true,
        featureKey: input.featureKey,
        featureId,
        kind,
        resourceUses: nextUses,
        message: "Divine Sense — sense Celestials, Fiends, and Undead within 60 feet for 10 minutes.",
      };
    }
    if (input.channelDivinitySpend === "sacred_weapon") {
      if (!hasClassSubclass(input.classes, "Paladin", "Oath of Devotion")) {
        return {
          ok: false,
          message: "Sacred Weapon requires the Oath of Devotion.",
        };
      }
      if (classLevel(input.classes, "Paladin") < 3) {
        return {
          ok: false,
          message: "Sacred Weapon requires Paladin level 3 or higher.",
        };
      }
      if (!input.abilityScores) {
        return { ok: false, message: "Ability scores required for Sacred Weapon." };
      }
      return {
        ok: true,
        featureKey: input.featureKey,
        featureId,
        kind,
        resourceUses: nextUses,
        selfEffects: [
          buildSacredWeaponEffect(input.characterId, {
            abilityScores: input.abilityScores,
          }),
        ],
        message: "Sacred Weapon — weapon attacks gain Charisma bonus and emit light.",
      };
    }
    if (!input.beneficiaryId) {
      return { ok: false, message: "Choose an Undead target for Turn Undead." };
    }
    const dc =
      input.proficiencyBonus != null && input.abilityScores
        ? channelDivinitySaveDc({
            proficiencyBonus: input.proficiencyBonus,
            abilityScores: input.abilityScores,
          })
        : 13;
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind,
      resourceUses: nextUses,
      healTarget: input.beneficiaryId,
      channelDivinityDc: dc,
      message: `Turn Undead — ${input.beneficiaryId} must succeed on a DC ${dc} Wisdom save or be Frightened.`,
    };
  }

  if (featureId === "monk-s-focus" && input.monkFocusSpend) {
    const monkLevel = classLevel(input.classes, "Monk");
    const kind = MONK_FOCUS_KIND[input.monkFocusSpend];
    if (input.monkFocusSpend === "flurry") {
      return {
        ok: true,
        featureKey: input.featureKey,
        featureId,
        kind,
        resourceUses: nextUses,
        bonusUnarmedAttacks: 2,
        unarmedDamageDie: martialArtsDie(monkLevel),
        message: `Flurry of Blows — two bonus unarmed strikes (${martialArtsDie(monkLevel)} each).`,
      };
    }
    if (input.monkFocusSpend === "patient_defense") {
      return {
        ok: true,
        featureKey: input.featureKey,
        featureId,
        kind,
        resourceUses: nextUses,
        startDodging: true,
        message: "Patient Defense — attacks against you have Disadvantage until your next turn.",
      };
    }
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind,
      resourceUses: nextUses,
      startDisengage: true,
      bonusMovementFeet: monkLevel * 5,
      message: `Step of the Wind — Disengage and +${monkLevel * 5} ft movement this turn.`,
    };
  }

  const action = classFeatureAction(featureId)!;

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
    const selfEffects = [
      buildRageEffect(input.characterId, barLevel),
      buildRageDamageEffect(input.characterId, barLevel),
    ];
    if (
      input.rageFrenzy &&
      hasClassSubclass(input.classes, "Barbarian", "Path of the Berserker")
    ) {
      selfEffects.push(buildFrenzyEffect(input.characterId));
    }
    return {
      ok: true,
      featureKey: input.featureKey,
      featureId,
      kind: "rage",
      resourceUses: nextUses,
      selfEffects,
      message: input.rageFrenzy
        ? `Frenzy activated (+${rageDamageBonus(barLevel)} damage, bonus-action melee attacks while raging).`
        : `Rage activated (+${rageDamageBonus(barLevel)} damage, B/P/S resistance).`,
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
