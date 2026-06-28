/**
 * @deprecated Import from `./toolbox-definitions` — "hazard" conflates Gameplay Toolbox vs Exploration.
 */
export {
  TRAP_RESET_MODES,
  TOOLBOX_TOPICS,
  POISON_TYPES,
  hazardDefinitionId,
  isValidGameplayToolboxEntryDefinition,
  isValidHazardDefinition,
  isValidTrapDefinition,
  toolboxEntryId,
  validateGameplayToolboxEntryDefinition,
  validateHazardDefinition,
  validateTrapDefinition,
  type CurseDefinition,
  type EnvironmentalEffectDefinition,
  type FearStressDefinition,
  type GameplayToolboxEntryDefinition,
  type HazardDefinition,
  type PoisonDefinition,
  type PoisonType,
  type ToolboxCheck,
  type ToolboxDamage,
  type ToolboxSave,
  type ToolboxTopic,
  type TrapDefinition,
  type TrapEffect,
  type TrapResetMode,
} from "./toolbox-definitions";

/** @deprecated Use {@link TOOLBOX_TOPICS}. */
export const HAZARD_KINDS = ["trap", "poison", "curse", "environmental_effect", "fear_stress"] as const;

/** @deprecated Use {@link ToolboxTopic}. */
export type HazardKind = (typeof HAZARD_KINDS)[number];

/** @deprecated Use {@link ToolboxSave}. */
export type HazardSave = import("./toolbox-definitions").ToolboxSave;

/** @deprecated Use {@link ToolboxDamage}. */
export type HazardDamage = import("./toolbox-definitions").ToolboxDamage;

/** @deprecated Use {@link EnvironmentalEffectDefinition}. */
export type EnvironmentalHazardDefinition = import("./toolbox-definitions").EnvironmentalEffectDefinition;

/** @deprecated Use {@link CurseDefinition}. */
export type DiseaseDefinition = import("./toolbox-definitions").CurseDefinition;
