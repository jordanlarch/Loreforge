/**
 * Spell save DC / spell attack derivation (#40, E3).
 *
 * Pure helpers: the caster's spellcasting ability modifier and proficiency
 * bonus are combined at cast time. Nothing is stored — these are recomputed on
 * every cast, so a changed ability score or level is reflected immediately.
 *
 *   spell save DC      = 8 + proficiency + ability modifier
 *   spell attack bonus =     proficiency + ability modifier
 */
import { abilityModifier } from "../entities/abilities";
import type { EntityState } from "../entities/types";

/** The caster's spellcasting-ability modifier, or undefined for a non-caster. */
export function spellcastingModifier(entity: EntityState): number | undefined {
  if (!entity.spellcasting) return undefined;
  return abilityModifier(entity.abilityScores[entity.spellcasting.ability]);
}

/** The caster's spell save DC, or undefined for a non-caster. */
export function spellSaveDC(entity: EntityState): number | undefined {
  const mod = spellcastingModifier(entity);
  if (mod === undefined) return undefined;
  return 8 + entity.proficiencyBonus + mod;
}

/** The caster's spell attack bonus, or undefined for a non-caster. */
export function spellAttackBonus(entity: EntityState): number | undefined {
  const mod = spellcastingModifier(entity);
  if (mod === undefined) return undefined;
  return entity.proficiencyBonus + mod;
}

/**
 * Number of damage dice a damaging cantrip rolls at a given character level
 * (SRD cantrip scaling): 1 die at levels 1–4, 2 at 5–10, 3 at 11–16, 4 at 17+.
 * This multiplies the cantrip's base dice count and is distinct from slot
 * upcast scaling (cantrips consume no slot).
 */
export function cantripDamageDice(characterLevel: number): number {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
}
