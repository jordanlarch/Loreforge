/**
 * Damage type modifiers — resistance, vulnerability, immunity (SRD-FID-19).
 *
 * Applied after rolled damage and save scaling, before temp-HP / current-HP
 * debiting. Entity fields are explicit lists; condition-driven modifiers (e.g.
 * petrified) layer on later via the Effect system.
 */
import type { ConditionState } from "../combat/conditions";
import type { DamageType } from "../content/spells";
import type { EntityState } from "../entities/types";

function normalizeDamageType(type: string): string {
  return type.toLowerCase();
}

function hasDamageType(
  list: readonly DamageType[] | undefined,
  damageType: string,
): boolean {
  if (!list?.length) return false;
  const normalized = normalizeDamageType(damageType);
  return list.some((entry) => normalizeDamageType(entry) === normalized);
}

/** Final damage after immunity / resistance / vulnerability (minimum 0). */
export function adjustDamageAmount(
  amount: number,
  damageType: string,
  entity: Pick<
    EntityState,
    | "damageImmunities"
    | "damageResistances"
    | "damageVulnerabilities"
    | "conditions"
    | "effects"
  >,
): number {
  if (amount <= 0) return 0;
  if (hasDamageType(entity.damageImmunities, damageType)) return 0;

  let adjusted = amount;
  const effectResist = entity.effects?.flatMap((fx) =>
    fx.modifier.type === "damage_resistance" ? fx.modifier.types : [],
  );
  const effectResistant =
    effectResist?.some(
      (entry) => normalizeDamageType(entry) === normalizeDamageType(damageType),
    ) ?? false;
  const resistant =
    hasDamageType(entity.damageResistances, damageType) ||
    effectResistant ||
    entity.conditions?.some((c) => c.condition === "petrified");
  const vulnerable = hasDamageType(entity.damageVulnerabilities, damageType);

  // Multiple resist/vuln instances to the same type count once; both cancel out.
  if (resistant && vulnerable) return adjusted;
  if (resistant) adjusted = Math.floor(adjusted / 2);
  else if (vulnerable) adjusted = adjusted * 2;
  return adjusted;
}
