/**
 * Declarative hazard / trap / poison / disease definitions (DATA-1b).
 * Codex advanced-rules prose remains source of truth until ingest lands;
 * this schema supports Smithy snapshots and future engine resolution.
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

export type HazardSave = {
  ability: Ability;
  dc: number;
  onSuccess: "none" | "half" | "negates";
};

export type HazardDamage = {
  dice: string;
  type: DamageType;
};

export type HazardDefinition = {
  id: string;
  name: string;
  kind: HazardKind;
  description: string;
  save?: HazardSave;
  damage?: HazardDamage[];
  /** Condition ids applied on failed save (engine condition keys). */
  conditions?: string[];
  /** Repeat interval in rounds/ minutes — prose-backed until duration engine lands. */
  repeat?: string;
};

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

export function validateHazardDefinition(def: HazardDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Hazard id is required.");
  if (!(HAZARD_KINDS as readonly string[]).includes(def.kind)) {
    errors.push("Unknown hazard kind.");
  }
  if (def.save) {
    if (def.save.dc < 1 || def.save.dc > 30) {
      errors.push("Save DC must be between 1 and 30.");
    }
  }
  def.damage?.forEach((row, i) => {
    if (!isValidDice(row.dice)) {
      errors.push(`Damage row ${i + 1} has invalid dice.`);
    }
    if (!(DAMAGE_TYPES as readonly string[]).includes(row.type)) {
      errors.push(`Damage row ${i + 1} has unknown damage type.`);
    }
  });
  return errors;
}

export function isValidHazardDefinition(def: HazardDefinition): boolean {
  return validateHazardDefinition(def).length === 0;
}
