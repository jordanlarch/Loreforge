/**
 * Pure attack-resolution helpers — to-hit logic and critical damage scaling.
 *
 * No state, no randomness: the d20 and damage dice are drawn upstream via the
 * seeded `ctx.roll`; these helpers only interpret already-rolled values. SRD
 * to-hit rules (SRD 5.2 "Making an Attack"): a natural 20 always hits and crits, a
 * natural 1 always misses, otherwise the total meets-or-beats AC. Critical hits
 * double the damage **dice** (not the flat modifier).
 */
import { parseDice } from "../rng/dice";

export type HitResolution = { hit: boolean; critical: boolean };

/**
 * Resolve whether an attack hits given the natural d20 face, the modified total,
 * and the target's AC. `forceCrit` upgrades any non-natural-1 hit to a critical
 * (e.g. a melee attack from within 5 ft of a paralyzed/unconscious target).
 */
export function resolveHit(
  natural: number,
  total: number,
  targetAc: number,
  options: { forceCrit?: boolean; critThreshold?: number } = {},
): HitResolution {
  const threshold = options.critThreshold ?? 20;
  if (natural === 20) return { hit: true, critical: true };
  if (natural === 1) return { hit: false, critical: false };
  const hit = total >= targetAc;
  const critical =
    hit &&
    (options.forceCrit === true ||
      natural >= threshold ||
      natural === 20);
  return { hit, critical };
}

/**
 * Double the dice count of a damage notation for a critical hit, preserving the
 * flat modifier. e.g. `1d8+3` → `2d8+3`, `2d6` → `4d6`. Keep-highest/lowest
 * selectors are dropped (weapon damage does not use them).
 */
export function criticalNotation(notation: string): string {
  const parsed = parseDice(notation);
  const mod =
    parsed.modifier === 0
      ? ""
      : parsed.modifier > 0
        ? `+${parsed.modifier}`
        : `${parsed.modifier}`;
  return `${parsed.count * 2}d${parsed.sides}${mod}`;
}
