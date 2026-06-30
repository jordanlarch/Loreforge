/**
 * Pure 5E ability/derivation helpers. No state, no randomness — safe to call
 * anywhere in the resolution pipeline.
 */
import { exhaustionD20Penalty } from "../combat/conditions";
import { fullCasterSlots } from "../content/spell-slots";
import type { Ability, ClassLevel, EntityInit, EntityState } from "./types";

/**
 * Classes that gain the Extra Attack feature at level 5 (two attacks per Attack
 * action). Fighter scales further (3 at 11, 4 at 20) and is handled separately.
 */
const EXTRA_ATTACK_CLASSES = new Set([
  "barbarian",
  "monk",
  "paladin",
  "ranger",
]);

/** Attacks granted by one Attack action for a single class at a given level. */
function classAttackCount(cls: string, level: number): number {
  const name = cls.trim().toLowerCase();
  if (name === "fighter") {
    if (level >= 20) return 4;
    if (level >= 11) return 3;
    if (level >= 5) return 2;
    return 1;
  }
  if (EXTRA_ATTACK_CLASSES.has(name)) return level >= 5 ? 2 : 1;
  return 1;
}

/**
 * Attacks granted by a single Attack action, derived from class levels. Extra
 * Attack does not stack across classes, so the best single class wins (SRD).
 */
export function extraAttackCount(classes: ClassLevel[]): number {
  return classes.reduce(
    (best, c) => Math.max(best, classAttackCount(c.class, c.level)),
    1,
  );
}

/**
 * How many attacks a creature makes with one Attack action this turn. An
 * explicit `attacksPerAction` (a monster's Multiattack) wins; otherwise it is
 * derived from class levels (Extra Attack). Always at least 1.
 */
export function attacksPerAction(entity: {
  attacksPerAction?: number;
  classes: ClassLevel[];
}): number {
  if (typeof entity.attacksPerAction === "number") {
    return Math.max(1, Math.floor(entity.attacksPerAction));
  }
  return extraAttackCount(entity.classes);
}

/** 5E ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Whether an entity is proficient in a saving throw (command override wins). */
export function isSaveProficient(
  entity: Pick<EntityState, "saveProficiencies" | "proficiencyBonus">,
  ability: Ability,
  override?: boolean,
): boolean {
  if (override !== undefined) return override;
  return entity.saveProficiencies.includes(ability);
}

/** Proficiency bonus added to a save when proficient. */
export function saveProficiencyBonus(
  entity: Pick<EntityState, "saveProficiencies" | "proficiencyBonus">,
  ability: Ability,
  override?: boolean,
): number {
  return isSaveProficient(entity, ability, override)
    ? entity.proficiencyBonus
    : 0;
}

/** d20 + ability mod + save proficiency + cover − exhaustion. */
export function saveRollTotal(
  entity: EntityState,
  ability: Ability,
  natural: number,
  opts?: { coverSave?: number; proficient?: boolean },
): number {
  return (
    natural +
    abilityModifier(entity.abilityScores[ability]) +
    saveProficiencyBonus(entity, ability, opts?.proficient) +
    (opts?.coverSave ?? 0) -
    exhaustionD20Penalty(entity.conditions)
  );
}

/** Total character level across all classes. */
export function totalLevel(classes: ClassLevel[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

/**
 * Proficiency bonus by total level (SRD 5.2 progression).
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
    saveProficiencies: init.saveProficiencies ? [...init.saveProficiencies] : [],
    ...(init.attacksPerAction !== undefined
      ? { attacksPerAction: init.attacksPerAction }
      : {}),
    ...(init.meleeReachFt !== undefined ? { meleeReachFt: init.meleeReachFt } : {}),
    ...(init.rangedAttackRangeFt !== undefined
      ? { rangedAttackRangeFt: init.rangedAttackRangeFt }
      : {}),
    ...(init.rangedAttackBonus !== undefined
      ? { rangedAttackBonus: init.rangedAttackBonus }
      : {}),
    ...(init.rangedDamage !== undefined ? { rangedDamage: init.rangedDamage } : {}),
    sceneId: init.sceneId,
    position: init.position,
    alive: init.maxHp > 0,
    conditions: [],
    dead: false,
    ...(init.spellcasting
      ? {
          spellcasting: {
            ability: init.spellcasting.ability,
            slots: fullCasterSlots(init.spellcasting.casterLevel ?? level),
            ...(init.spellcasting.preparedSpellIds
              ? { preparedSpellIds: [...init.spellcasting.preparedSpellIds] }
              : {}),
          },
        }
      : {}),
    ...(init.coatedPoisonSlug ? { coatedPoisonSlug: init.coatedPoisonSlug } : {}),
    ...(init.damageResistances?.length
      ? { damageResistances: [...init.damageResistances] }
      : {}),
    ...(init.damageVulnerabilities?.length
      ? { damageVulnerabilities: [...init.damageVulnerabilities] }
      : {}),
    ...(init.damageImmunities?.length
      ? { damageImmunities: [...init.damageImmunities] }
      : {}),
  };
}
