/**
 * Damage type modifiers — resistance, vulnerability, immunity (SRD-FID-19).
 *
 * Applied after rolled damage and save scaling, before temp-HP / current-HP
 * debiting. Entity fields are explicit lists; condition-driven modifiers (e.g.
 * petrified) layer on later via the Effect system.
 */
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
    "damageImmunities" | "damageResistances" | "damageVulnerabilities"
  >,
): number {
  if (amount <= 0) return 0;
  if (hasDamageType(entity.damageImmunities, damageType)) return 0;

  const resistant = hasDamageType(entity.damageResistances, damageType);
  const vulnerable = hasDamageType(entity.damageVulnerabilities, damageType);

  // Multiple resist/vuln instances to the same type count once; both cancel out.
  if (resistant && vulnerable) return amount;
  if (resistant) return Math.floor(amount / 2);
  if (vulnerable) return amount * 2;
  return amount;
}
