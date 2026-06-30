/**
 * SRD class-feature combat math (SRD-FID-21).
 */
import { distanceFeet } from "./grid";
import type { RollAdjust } from "./conditions";
import type { ClassLevel, EntityState } from "../entities/types";

export function classLevel(
  classes: readonly ClassLevel[] | undefined,
  className: string,
): number {
  if (!classes?.length) return 0;
  const needle = className.trim().toLowerCase();
  return classes
    .filter((c) => c.class.trim().toLowerCase() === needle)
    .reduce((sum, c) => sum + c.level, 0);
}

/** Sneak Attack dice count by rogue level (SRD 5.2.1). */
export function sneakAttackDiceCount(rogueLevel: number): number {
  if (rogueLevel < 1) return 0;
  return Math.ceil(rogueLevel / 2);
}

export function sneakAttackNotation(rogueLevel: number): string {
  const dice = sneakAttackDiceCount(rogueLevel);
  return dice > 0 ? `${dice}d6` : "0";
}

/** Rage damage bonus on Strength-based weapon attacks. */
export function rageDamageBonus(barbarianLevel: number): number {
  if (barbarianLevel < 1) return 0;
  if (barbarianLevel >= 16) return 4;
  if (barbarianLevel >= 9) return 3;
  return 2;
}

/** Bardic Inspiration die notation by bard level. */
export function bardicInspirationDie(bardLevel: number): string {
  if (bardLevel >= 15) return "1d12";
  if (bardLevel >= 10) return "1d10";
  if (bardLevel >= 5) return "1d8";
  return "1d6";
}

type SneakWorld = {
  entities: Record<string, EntityState | undefined>;
};

/** True when Sneak Attack extra damage applies (once per turn; caller checks hit + budget). */
export function sneakAttackEligible(
  attacker: EntityState,
  target: EntityState,
  world: SneakWorld,
  attackMode: RollAdjust,
  opts: { finesseOrRanged?: boolean },
): boolean {
  const rogueLevel = classLevel(attacker.classes, "Rogue");
  if (rogueLevel < 1 || !opts.finesseOrRanged) return false;
  if (attackMode === "advantage") return true;
  if (!target.position || !target.sceneId) return false;
  for (const [id, entity] of Object.entries(world.entities)) {
    if (!entity?.position || entity.sceneId !== target.sceneId) continue;
    if (id === attacker.id || id === target.id) continue;
    if (distanceFeet(entity.position, target.position) <= 5) return true;
  }
  return false;
}

export function allyWithinFiveFeet(
  target: Pick<EntityState, "position" | "sceneId">,
  ally: Pick<EntityState, "position" | "sceneId">,
): boolean {
  if (
    !target.position ||
    !ally.position ||
    target.sceneId !== ally.sceneId
  ) {
    return false;
  }
  return distanceFeet(target.position, ally.position) <= 5;
}
