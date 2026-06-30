/**
 * Minimal active-effect system (ENG-13 tracer).
 *
 * Spells attach {@link ActiveEffect} records to entities; combat resolution
 * reads them for AC, attack, speed, and on-hit damage modifiers.
 */
import type { EntityRef, EntityState } from "../entities/types";
import type { SpellAppliedEffect, SpellDefinition } from "../content/spells";
import { effectiveSpeed } from "./conditions";

export type EffectModifier =
  | { type: "ac_bonus"; amount: number }
  | { type: "attack_roll_bonus"; dice: string }
  | { type: "attack_roll_penalty"; dice: string }
  | { type: "hunters_mark"; dice: string; markedBy: EntityRef }
  | { type: "attacks_against_advantage" }
  | { type: "attacks_against_disadvantage" }
  | { type: "help_attack"; foe: EntityRef; helper: EntityRef }
  | { type: "help_check"; helper: EntityRef }
  | { type: "speed_bonus"; amount: number }
  | { type: "damage_resistance"; types: string[] }
  | { type: "rage_damage_bonus"; amount: number }
  | { type: "bardic_inspiration"; die: string };

export type ActiveEffect = {
  id: string;
  name: string;
  source: EntityRef;
  modifier: EffectModifier;
  /** When the concentration holder loses this spell, the effect ends. */
  concentration?: { holder: EntityRef; spell: string };
  /** Removed at the start of this entity's next turn (Shield). */
  expiresStartOfTurn?: EntityRef;
  /** Combat rounds remaining (non-concentration timed effects). */
  remainingRounds?: number;
};

export function effectiveAc(entity: EntityState): number {
  let ac = entity.baseAc;
  for (const fx of entity.effects ?? []) {
    if (fx.modifier.type === "ac_bonus") ac += fx.modifier.amount;
  }
  return ac;
}

/** Speed after conditions and effect riders (Haste, etc.). */
export function effectiveSpeedForEntity(entity: EntityState): number {
  let speed = effectiveSpeed(entity.speed, entity.conditions);
  for (const fx of entity.effects ?? []) {
    if (fx.modifier.type === "speed_bonus") {
      speed += fx.modifier.amount;
    }
  }
  return speed;
}

/** Bless-style d4 (etc.) dice to roll and add to an attack total. */
export function attackRollBonusDice(attacker: EntityState): string[] {
  const dice: string[] = [];
  for (const fx of attacker.effects ?? []) {
    if (fx.modifier.type === "attack_roll_bonus") {
      dice.push(fx.modifier.dice);
    }
    if (fx.modifier.type === "bardic_inspiration") {
      dice.push(fx.modifier.die);
    }
  }
  return dice;
}

/** Remove one consumed Bardic Inspiration effect after it modifies a roll. */
export function stripOneBardicInspiration(entity: EntityState): ActiveEffect[] {
  const effects = entity.effects ?? [];
  let removed = false;
  return effects.filter((fx) => {
    if (!removed && fx.modifier.type === "bardic_inspiration") {
      removed = true;
      return false;
    }
    return true;
  });
}

export function rageDamageBonusFromEffects(entity: EntityState): number {
  for (const fx of entity.effects ?? []) {
    if (fx.modifier.type === "rage_damage_bonus") {
      return fx.modifier.amount;
    }
  }
  return 0;
}

export function effectDamageResistances(entity: EntityState): string[] {
  const types: string[] = [];
  for (const fx of entity.effects ?? []) {
    if (fx.modifier.type === "damage_resistance") {
      types.push(...fx.modifier.types);
    }
  }
  return types;
}

/** Bane-style d4 (etc.) dice to subtract from an attack total. */
export function attackRollPenaltyDice(attacker: EntityState): string[] {
  return (attacker.effects ?? [])
    .filter(
      (
        fx,
      ): fx is ActiveEffect & { modifier: { type: "attack_roll_penalty"; dice: string } } =>
        fx.modifier.type === "attack_roll_penalty",
    )
    .map((fx) => fx.modifier.dice);
}

/** Faerie Fire — attacks against this creature have advantage. */
export function attacksAgainstHaveAdvantage(target: EntityState): boolean {
  return (target.effects ?? []).some(
    (fx) => fx.modifier.type === "attacks_against_advantage",
  );
}

/** Blur — attacks against this creature have disadvantage. */
export function attacksAgainstHaveDisadvantage(target: EntityState): boolean {
  if (target.dodging) return true;
  return (target.effects ?? []).some(
    (fx) => fx.modifier.type === "attacks_against_disadvantage",
  );
}

/** Help action — advantage on the beneficiary's next attack against `foe`. */
export function helpAttackMode(
  attacker: EntityState,
  target: EntityRef,
): "advantage" | "normal" {
  const fx = (attacker.effects ?? []).find(
    (e): e is ActiveEffect & { modifier: { type: "help_attack"; foe: EntityRef } } =>
      e.modifier.type === "help_attack" && e.modifier.foe === target,
  );
  return fx ? "advantage" : "normal";
}

/** Help action — advantage on the next ability check. */
export function helpCheckMode(entity: EntityState): "advantage" | "normal" {
  return (entity.effects ?? []).some((fx) => fx.modifier.type === "help_check")
    ? "advantage"
    : "normal";
}

export function stripHelpAttackEffect(
  entity: EntityState,
  foe: EntityRef,
): ActiveEffect[] {
  return (entity.effects ?? []).filter(
    (fx) => !(fx.modifier.type === "help_attack" && fx.modifier.foe === foe),
  );
}

export function stripHelpCheckEffects(entity: EntityState): ActiveEffect[] {
  return (entity.effects ?? []).filter((fx) => fx.modifier.type !== "help_check");
}

/** Active Hunter's Mark on `target` placed by `attacker`, if any. */
export function huntersMarkOn(
  target: EntityState,
  attacker: EntityRef,
): ActiveEffect | undefined {
  return (target.effects ?? []).find(
    (fx) =>
      fx.modifier.type === "hunters_mark" &&
      fx.modifier.markedBy === attacker,
  );
}

export function effectFromSpec(
  spec: SpellAppliedEffect,
  opts: {
    id: string;
    source: EntityRef;
    concentrationHolder?: EntityRef;
    concentrationSpell?: string;
    markedBy?: EntityRef;
    expiresStartOfTurn?: EntityRef;
    remainingRounds?: number;
  },
): ActiveEffect {
  let modifier: EffectModifier;
  if (spec.modifier.type === "ac_bonus") {
    modifier = { type: "ac_bonus", amount: spec.modifier.amount };
  } else if (spec.modifier.type === "attack_roll_bonus") {
    modifier = { type: "attack_roll_bonus", dice: spec.modifier.dice };
  } else if (spec.modifier.type === "attack_roll_penalty") {
    modifier = { type: "attack_roll_penalty", dice: spec.modifier.dice };
  } else if (spec.modifier.type === "attacks_against_advantage") {
    modifier = { type: "attacks_against_advantage" };
  } else if (spec.modifier.type === "attacks_against_disadvantage") {
    modifier = { type: "attacks_against_disadvantage" };
  } else if (spec.modifier.type === "speed_bonus") {
    modifier = { type: "speed_bonus", amount: spec.modifier.amount };
  } else {
    modifier = {
      type: "hunters_mark",
      dice: spec.modifier.dice,
      markedBy: opts.markedBy ?? opts.source,
    };
  }
  return {
    id: opts.id,
    name: spec.name,
    source: opts.source,
    modifier,
    ...(opts.concentrationHolder && opts.concentrationSpell
      ? {
          concentration: {
            holder: opts.concentrationHolder,
            spell: opts.concentrationSpell,
          },
        }
      : {}),
    ...(opts.expiresStartOfTurn
      ? { expiresStartOfTurn: opts.expiresStartOfTurn }
      : {}),
    ...(opts.remainingRounds !== undefined
      ? { remainingRounds: opts.remainingRounds }
      : {}),
  };
}

/** Map spell duration to combat rounds for timed (non-concentration) effects. */
export function spellDurationRounds(spell: SpellDefinition): number | undefined {
  if (spell.concentration || spell.duration.unit === "instantaneous") {
    return undefined;
  }
  const amount = spell.duration.amount ?? 1;
  switch (spell.duration.unit) {
    case "round":
      return amount;
    case "minute":
      return amount * 10;
    default:
      return undefined;
  }
}

/** Strip effects that expire when `entityId` begins their turn. */
export function expireStartOfTurnEffects(
  entity: EntityState,
  entityId: EntityRef,
): ActiveEffect[] {
  return (entity.effects ?? []).filter(
    (fx) => fx.expiresStartOfTurn !== entityId,
  );
}

/** Remove all effects tied to a broken concentration across all entities. */
export function stripConcentrationEffects(
  entities: Record<EntityRef, EntityState>,
  holder: EntityRef,
  spell: string,
): Record<EntityRef, EntityState> {
  const next = { ...entities };
  for (const id of Object.keys(next)) {
    const entity = next[id]!;
    const effects = (entity.effects ?? []).filter(
      (fx) =>
        !(
          fx.concentration?.holder === holder &&
          fx.concentration.spell === spell
        ),
    );
    if (effects.length !== (entity.effects ?? []).length) {
      next[id] = { ...entity, effects };
    }
  }
  return next;
}

/** Remove concentration-linked conditions across all entities. */
export function stripConcentrationConditions(
  entities: Record<EntityRef, EntityState>,
  holder: EntityRef,
  spell: string,
): Record<EntityRef, EntityState> {
  const next = { ...entities };
  for (const id of Object.keys(next)) {
    const entity = next[id]!;
    const conditions = entity.conditions.filter(
      (c) =>
        !(
          c.concentrationHolder === holder && c.concentrationSpell === spell
        ),
    );
    if (conditions.length !== entity.conditions.length) {
      next[id] = { ...entity, conditions };
    }
  }
  return next;
}

/** Decrement timed effects in-place on the entity map. */
export function applyTimedEffectTick(
  entities: Record<EntityRef, EntityState>,
): Record<EntityRef, EntityState> {
  const next = { ...entities };
  for (const id of Object.keys(next)) {
    const entity = next[id]!;
    if (!entity.effects?.some((fx) => fx.remainingRounds !== undefined)) {
      continue;
    }
    const effects = (entity.effects ?? []).flatMap((fx) => {
      if (fx.remainingRounds === undefined) return [fx];
      const remaining = fx.remainingRounds - 1;
      return remaining > 0 ? [{ ...fx, remainingRounds: remaining }] : [];
    });
    next[id] = { ...entity, effects };
  }
  return next;
}
