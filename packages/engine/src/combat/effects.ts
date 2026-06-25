/**
 * Minimal active-effect system (ENG-13 tracer).
 *
 * Spells attach {@link ActiveEffect} records to entities; combat resolution
 * reads them for AC, attack, and on-hit damage modifiers.
 */
import type { EntityRef, EntityState } from "../entities/types";
import type { SpellAppliedEffect } from "../content/spells";

export type EffectModifier =
  | { type: "ac_bonus"; amount: number }
  | { type: "attack_roll_bonus"; dice: string }
  | { type: "attack_roll_penalty"; dice: string }
  | { type: "hunters_mark"; dice: string; markedBy: EntityRef }
  | { type: "attacks_against_advantage" };

export type ActiveEffect = {
  id: string;
  name: string;
  source: EntityRef;
  modifier: EffectModifier;
  /** When the concentration holder loses this spell, the effect ends. */
  concentration?: { holder: EntityRef; spell: string };
  /** Removed at the start of this entity's next turn (Shield). */
  expiresStartOfTurn?: EntityRef;
};

export function effectiveAc(entity: EntityState): number {
  let ac = entity.baseAc;
  for (const fx of entity.effects ?? []) {
    if (fx.modifier.type === "ac_bonus") ac += fx.modifier.amount;
  }
  return ac;
}

/** Bless-style d4 (etc.) dice to roll and add to an attack total. */
export function attackRollBonusDice(attacker: EntityState): string[] {
  return (attacker.effects ?? [])
    .filter(
      (fx): fx is ActiveEffect & { modifier: { type: "attack_roll_bonus"; dice: string } } =>
        fx.modifier.type === "attack_roll_bonus",
    )
    .map((fx) => fx.modifier.dice);
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
  };
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
