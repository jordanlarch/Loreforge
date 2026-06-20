/**
 * Pure 5E ability/derivation helpers. No state, no randomness — safe to call
 * anywhere in the resolution pipeline.
 */
import type { ClassLevel, EntityInit, EntityState } from "./types";

/** 5E ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Total character level across all classes. */
export function totalLevel(classes: ClassLevel[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

/**
 * Proficiency bonus by total level (PHB progression).
 * Levels 1-4 → +2, 5-8 → +3, 9-12 → +4, 13-16 → +5, 17-20 → +6.
 */
export function proficiencyBonusForLevel(level: number): number {
  if (level <= 0) return 2;
  return 2 + Math.floor((Math.min(level, 20) - 1) / 4);
}

/** Build a fully-defaulted EntityState from an init shape. */
export function createEntityState(init: EntityInit): EntityState {
  const classes = init.classes ?? [];
  const level = totalLevel(classes);
  return {
    id: init.id,
    kind: init.kind,
    name: init.name,
    abilityScores: { ...init.abilityScores },
    hp: { current: init.maxHp, max: init.maxHp, temp: 0 },
    baseAc: init.baseAc,
    speed: init.speed ?? 30,
    classes,
    proficiencyBonus: proficiencyBonusForLevel(level),
    sceneId: init.sceneId,
    position: init.position,
    alive: init.maxHp > 0,
    conditions: [],
  };
}
