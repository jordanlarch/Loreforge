/**
 * Declarative hazard / trap / poison / disease / environmental definitions (DATA-1b).
 *
 * Discriminated by `kind` with SRD-aligned fields per category. Codex advanced-rules
 * prose remains ingest source until per-entry normalization lands — see
 * `docs/data-model-hazards.md` for grill backlog.
 */
import { parseDice } from "../rng/dice";
import type { Ability } from "../entities/types";
import { DAMAGE_TYPES, type DamageType } from "./spells";

export const HAZARD_KINDS = [
  "environmental",
  "trap",
  "poison",
  "disease",
] as const;

export type HazardKind = (typeof HAZARD_KINDS)[number];

export const POISON_TYPES = [
  "contact",
  "ingested",
  "inhaled",
  "injury",
] as const;

export type PoisonType = (typeof POISON_TYPES)[number];

export type HazardSave = {
  ability: Ability;
  dc: number;
  onSuccess: "none" | "half" | "negates";
};

export type HazardDamage = {
  dice: string;
  type: DamageType;
};

type HazardDefinitionBase = {
  id: string;
  name: string;
  description: string;
};

/** SRD trap entry — trigger, detection/disable DCs, effect on failed save. */
export type TrapDefinition = HazardDefinitionBase & {
  kind: "trap";
  trigger?: string;
  detectionDc?: number;
  disableDc?: number;
  save?: HazardSave;
  damage?: HazardDamage[];
  conditions?: string[];
};

/** SRD poison entry — delivery type + save/damage cadence. */
export type PoisonDefinition = HazardDefinitionBase & {
  kind: "poison";
  poisonType: PoisonType;
  save?: HazardSave;
  damage?: HazardDamage[];
  conditions?: string[];
  /** Repeat interval in rounds/minutes — prose-backed until duration engine lands. */
  repeat?: string;
};

/** SRD disease entry — contagion, progression, recovery. */
export type DiseaseDefinition = HazardDefinitionBase & {
  kind: "disease";
  contagion?: string;
  save?: HazardSave;
  /** Symptom / stage prose or condition ids per failed save. */
  effects?: string[];
  recovery?: string;
};

/** Environmental hazard — area, duration, ongoing effect. */
export type EnvironmentalHazardDefinition = HazardDefinitionBase & {
  kind: "environmental";
  area?: string;
  duration?: string;
  save?: HazardSave;
  damage?: HazardDamage[];
  conditions?: string[];
  repeat?: string;
};

export type HazardDefinition =
  | TrapDefinition
  | PoisonDefinition
  | DiseaseDefinition
  | EnvironmentalHazardDefinition;

export function hazardDefinitionId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hazard"
  );
}

function isValidDice(notation: string): boolean {
  try {
    parseDice(notation);
    return true;
  } catch {
    return false;
  }
}

function validateSave(save: HazardSave | undefined, errors: string[]): void {
  if (!save) return;
  if (save.dc < 1 || save.dc > 30) {
    errors.push("Save DC must be between 1 and 30.");
  }
}

function validateDamageRows(
  damage: HazardDamage[] | undefined,
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

function validateOptionalDc(
  label: string,
  dc: number | undefined,
  errors: string[],
): void {
  if (dc == null) return;
  if (dc < 1 || dc > 30) {
    errors.push(`${label} must be between 1 and 30.`);
  }
}

export function validateHazardDefinition(def: HazardDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Hazard id is required.");
  if (!(HAZARD_KINDS as readonly string[]).includes(def.kind)) {
    errors.push("Unknown hazard kind.");
  }

  validateSave(def.save, errors);

  switch (def.kind) {
    case "trap":
      validateDamageRows(def.damage, errors);
      validateOptionalDc("Detection DC", def.detectionDc, errors);
      validateOptionalDc("Disable DC", def.disableDc, errors);
      break;
    case "poison":
      if (!(POISON_TYPES as readonly string[]).includes(def.poisonType)) {
        errors.push("Unknown poison delivery type.");
      }
      validateDamageRows(def.damage, errors);
      break;
    case "disease":
      break;
    case "environmental":
      validateDamageRows(def.damage, errors);
      break;
  }

  return errors;
}

export function isValidHazardDefinition(def: HazardDefinition): boolean {
  return validateHazardDefinition(def).length === 0;
}
