/**
 * SRD Gameplay Toolbox entry definitions (DATA-1b).
 * Traps, poisons, curses, environmental effects, fear — distinct from Exploration hazards.
 */
import { parseDice } from "../rng/dice";
import type { Ability } from "../entities/types";
import { DAMAGE_TYPES, type DamageType } from "./spells";

/** Gameplay Toolbox topics matching SRD 5.2 PDF section names. */
export const TOOLBOX_TOPICS = [
  "trap",
  "poison",
  "curse",
  "environmental_effect",
  "fear_stress",
] as const;

export type ToolboxTopic = (typeof TOOLBOX_TOPICS)[number];

export const TRAP_RESET_MODES = ["once", "manual", "timed"] as const;
export type TrapResetMode = (typeof TRAP_RESET_MODES)[number];

export const POISON_TYPES = [
  "contact",
  "ingested",
  "inhaled",
  "injury",
] as const;
export type PoisonType = (typeof POISON_TYPES)[number];

export type ToolboxSave = {
  ability: Ability;
  dc: number;
  onSuccess: "none" | "half" | "negates";
};

export type ToolboxDamage = {
  dice: string;
  type: DamageType;
};

/** Perception / Thieves' Tools check for detect or disable (GRILL-TRAP Q3). */
export type ToolboxCheck = {
  dc: number;
  ability: Ability;
  skill?: string;
  tool?: string;
};

export type TrapEffectStructured = {
  save?: ToolboxSave;
  damage?: ToolboxDamage[];
  conditions?: string[];
};

export type TrapEffect = TrapEffectStructured & {
  /** Escape hatch for non-standard trap effects. */
  effectProse?: string;
};

type ToolboxEntryBase = {
  id: string;
  name: string;
  description: string;
};

/** SRD trap sample entry — mandatory trigger + effect (GRILL-TRAP Q3). */
export type TrapDefinition = ToolboxEntryBase & {
  kind: "trap";
  trigger: string;
  effect: TrapEffect;
  detect?: ToolboxCheck;
  disable?: ToolboxCheck;
  reset: TrapResetMode;
  /** Prose interval when reset is timed, e.g. "1 minute". */
  resetInterval?: string;
};

export type PoisonDefinition = ToolboxEntryBase & {
  kind: "poison";
  poisonType: PoisonType;
  save?: ToolboxSave;
  damage?: ToolboxDamage[];
  conditions?: string[];
  repeat?: string;
};

export type CurseDefinition = ToolboxEntryBase & {
  kind: "curse";
  contagion?: string;
  save?: ToolboxSave;
  effects?: string[];
  /** Structured conditions applied on failed initial save (GRILL-LIVE-CURSE). */
  conditions?: string[];
  recovery?: string;
};

export type EnvironmentalEffectDefinition = ToolboxEntryBase & {
  kind: "environmental_effect";
  area?: string;
  duration?: string;
  save?: ToolboxSave;
  damage?: ToolboxDamage[];
  conditions?: string[];
  repeat?: string;
};

export type FearStressDefinition = ToolboxEntryBase & {
  kind: "fear_stress";
  save?: ToolboxSave;
  effects?: string[];
  duration?: string;
};

export type GameplayToolboxEntryDefinition =
  | TrapDefinition
  | PoisonDefinition
  | CurseDefinition
  | EnvironmentalEffectDefinition
  | FearStressDefinition;

/** @deprecated Use {@link GameplayToolboxEntryDefinition}. */
export type HazardDefinition = GameplayToolboxEntryDefinition;

export function toolboxEntryId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "toolbox-entry"
  );
}

/** @deprecated Use {@link toolboxEntryId}. */
export const hazardDefinitionId = toolboxEntryId;

function isValidDice(notation: string): boolean {
  try {
    parseDice(notation);
    return true;
  } catch {
    return false;
  }
}

function validateSave(save: ToolboxSave | undefined, errors: string[]): void {
  if (!save) return;
  if (save.dc < 1 || save.dc > 30) {
    errors.push("Save DC must be between 1 and 30.");
  }
}

function validateCheck(check: ToolboxCheck | undefined, label: string, errors: string[]): void {
  if (!check) return;
  if (check.dc < 1 || check.dc > 30) {
    errors.push(`${label} DC must be between 1 and 30.`);
  }
}

function validateDamageRows(
  damage: ToolboxDamage[] | undefined,
  errors: string[],
): void {
  damage?.forEach((row, i) => {
    if (!isValidDice(row.dice)) {
      errors.push(`Damage row ${i + 1} has invalid dice.`);
    }
    if (!(DAMAGE_TYPES as readonly string[]).includes(row.type)) {
      errors.push(`Damage row ${i + 1} has unknown damage type.`);
    }
  });
}

function hasTrapEffect(effect: TrapEffect): boolean {
  if (effect.effectProse?.trim()) return true;
  if (effect.save || effect.damage?.length || effect.conditions?.length) return true;
  return false;
}

function hasPoisonEffect(def: PoisonDefinition): boolean {
  if (def.save) return true;
  if (def.damage?.length) return true;
  if (def.conditions?.length) return true;
  if (def.repeat?.trim()) return true;
  return false;
}

function hasCurseEffect(def: CurseDefinition): boolean {
  if (def.save) return true;
  if (def.effects?.length) return true;
  if (def.conditions?.length) return true;
  if (def.contagion?.trim()) return true;
  if (def.recovery?.trim()) return true;
  return false;
}

function hasEnvironmentalEffect(def: EnvironmentalEffectDefinition): boolean {
  if (def.area?.trim()) return true;
  if (def.duration?.trim()) return true;
  if (def.save) return true;
  if (def.damage?.length) return true;
  if (def.conditions?.length) return true;
  if (def.repeat?.trim()) return true;
  return false;
}

function hasFearStressEffect(def: FearStressDefinition): boolean {
  if (def.save) return true;
  if (def.effects?.length) return true;
  if (def.duration?.trim()) return true;
  return false;
}

export function validateTrapDefinition(def: TrapDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Trap id is required.");
  if (!def.trigger?.trim()) errors.push("Trigger is required.");
  if (!hasTrapEffect(def.effect)) {
    errors.push("Effect requires save/damage/conditions or effect prose.");
  }
  if (!(TRAP_RESET_MODES as readonly string[]).includes(def.reset)) {
    errors.push("Unknown trap reset mode.");
  }
  validateSave(def.effect.save, errors);
  validateDamageRows(def.effect.damage, errors);
  validateCheck(def.detect, "Detection", errors);
  validateCheck(def.disable, "Disable", errors);
  return errors;
}

export function validatePoisonDefinition(def: PoisonDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Entry id is required.");
  if (!(POISON_TYPES as readonly string[]).includes(def.poisonType)) {
    errors.push("Unknown poison delivery type.");
  }
  if (!hasPoisonEffect(def)) {
    errors.push("Poison requires save, damage, conditions, or repeat rules.");
  }
  validateSave(def.save, errors);
  validateDamageRows(def.damage, errors);
  return errors;
}

export function validateCurseDefinition(def: CurseDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Entry id is required.");
  if (!hasCurseEffect(def)) {
    errors.push("Curse requires save, effects, contagion, or recovery rules.");
  }
  validateSave(def.save, errors);
  return errors;
}

export function validateEnvironmentalEffectDefinition(
  def: EnvironmentalEffectDefinition,
): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Entry id is required.");
  if (!hasEnvironmentalEffect(def)) {
    errors.push(
      "Environmental effect requires area, duration, save, damage, conditions, or repeat rules.",
    );
  }
  validateSave(def.save, errors);
  validateDamageRows(def.damage, errors);
  return errors;
}

export function validateFearStressDefinition(
  def: FearStressDefinition,
): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Entry id is required.");
  if (!hasFearStressEffect(def)) {
    errors.push("Fear/stress requires save, effects, or duration rules.");
  }
  validateSave(def.save, errors);
  return errors;
}

export function validateGameplayToolboxEntryDefinition(
  def: GameplayToolboxEntryDefinition,
): string[] {
  if (def.kind === "trap") return validateTrapDefinition(def);
  if (def.kind === "poison") return validatePoisonDefinition(def);
  if (def.kind === "curse") return validateCurseDefinition(def);
  if (def.kind === "environmental_effect") {
    return validateEnvironmentalEffectDefinition(def);
  }
  if (def.kind === "fear_stress") return validateFearStressDefinition(def);

  const _exhaustive: never = def;
  return _exhaustive;
}

/** @deprecated Use {@link validateGameplayToolboxEntryDefinition}. */
export function validateHazardDefinition(def: HazardDefinition): string[] {
  return validateGameplayToolboxEntryDefinition(def);
}

export function isValidTrapDefinition(def: TrapDefinition): boolean {
  return validateTrapDefinition(def).length === 0;
}

export function isValidPoisonDefinition(def: PoisonDefinition): boolean {
  return validatePoisonDefinition(def).length === 0;
}

export function isValidCurseDefinition(def: CurseDefinition): boolean {
  return validateCurseDefinition(def).length === 0;
}

export function isValidEnvironmentalEffectDefinition(
  def: EnvironmentalEffectDefinition,
): boolean {
  return validateEnvironmentalEffectDefinition(def).length === 0;
}

export function isValidFearStressDefinition(
  def: FearStressDefinition,
): boolean {
  return validateFearStressDefinition(def).length === 0;
}

export function isValidGameplayToolboxEntryDefinition(
  def: GameplayToolboxEntryDefinition,
): boolean {
  return validateGameplayToolboxEntryDefinition(def).length === 0;
}

/** @deprecated Use {@link isValidGameplayToolboxEntryDefinition}. */
export function isValidHazardDefinition(def: HazardDefinition): boolean {
  return isValidGameplayToolboxEntryDefinition(def);
}
