/**
 * SRD 5.2 Exploration hazard constants — engine runtime (GRILL-EXPLORATION Slice 2).
 * Codex glossary slugs in packages/db/src/ingest/srd-exploration-hazards.ts.
 */
export const BURNING_SLUG = "srd-2024_burning";
export const FALLING_SLUG = "srd-2024_falling";

/** Turn-start fire damage while burning (Rules Glossary). */
export const BURNING_TICK_DAMAGE = "1d4";

/** Dexterity save DC to extinguish flames as an action. */
export const BURNING_EXTINGUISH_DC = 15;

export const FALL_DAMAGE_MAX_DICE = 20;

export function fallDamageDiceCount(heightFt: number): number {
  if (heightFt <= 0) return 0;
  return Math.min(Math.floor(heightFt / 10), FALL_DAMAGE_MAX_DICE);
}

export function fallDamageNotation(heightFt: number): string | null {
  const count = fallDamageDiceCount(heightFt);
  if (count <= 0) return null;
  return `${count}d6`;
}

export function isBurningSlug(slug: string): boolean {
  return slug === BURNING_SLUG;
}
