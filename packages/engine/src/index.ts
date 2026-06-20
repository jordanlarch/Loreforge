/**
 * @app/engine — deterministic 5E rules engine.
 *
 * E1 (Engine Skeleton): event store + projections, seeded deterministic dice,
 * base entities, and the Command API. Combat, conditions, spells, and Yjs sync
 * arrive in E2+.
 *
 * @see docs/engine/architecture.md
 */

export const ENGINE_VERSION = "0.1.0-e1" as const;

export type EngineHealth = {
  version: typeof ENGINE_VERSION;
  ready: boolean;
};

export function getEngineHealth(): EngineHealth {
  return { version: ENGINE_VERSION, ready: true };
}

// Core
export { Engine } from "./engine";
export type { EngineOptions, ExecuteOptions } from "./engine";
export { createId } from "./id";

// RNG / dice
export {
  parseDice,
  rollD20,
  rollDice,
  type DiceRoll,
  type DiceNotation,
  type ParsedDice,
  type RollMode,
} from "./rng/dice";
export {
  createSeededRng,
  mulberry32,
  randomInt,
  xmur3,
  type Rng,
} from "./rng/prng";

// Entities
export {
  abilityModifier,
  createEntityState,
  proficiencyBonusForLevel,
  totalLevel,
} from "./entities/abilities";
export {
  ABILITIES,
  type Ability,
  type AbilityScores,
  type ClassLevel,
  type EntityInit,
  type EntityKind,
  type EntityRef,
  type EntityState,
  type GridPosition,
  type HitPoints,
  type SceneId,
  type SceneState,
} from "./entities/types";
export {
  applyAbilityBonuses,
  ASI_LEVELS,
  baseArmorClass,
  featureStubsForLevel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  isValidPointBuy,
  levelUpSeed,
  MANUAL_MAX,
  MANUAL_MIN,
  maxHpAtFirstLevel,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  pointBuyCost,
  pointBuyRemaining,
  SKILL_ABILITY,
  SKILLS,
  STANDARD_ARRAY,
  totalPointBuyCost,
  type HpMethod,
  type Skill,
} from "./entities/character-build";

// Content taxonomy
export {
  ITEM_RARITIES,
  ITEM_SOURCES,
  ITEM_TYPES,
  type ItemRarity,
  type ItemSource,
  type ItemType,
} from "./content/items";
export {
  AREA_SHAPES,
  CASTING_TIME_UNITS,
  DAMAGE_TYPES,
  DURATION_UNITS,
  isValidSpellDefinition,
  RANGE_TYPES,
  SAVE_OUTCOMES,
  SPELL_LEVELS,
  SPELL_SCHOOLS,
  TARGETING_TYPES,
  validateSpellDefinition,
  type AreaShape,
  type CastingTime,
  type CastingTimeUnit,
  type DamageComponent,
  type DamageType,
  type DurationUnit,
  type HealingComponent,
  type RangeType,
  type SaveAgainst,
  type SaveOutcome,
  type SpellAttack,
  type SpellComponents,
  type SpellDefinition,
  type SpellDuration,
  type SpellLevel,
  type SpellRange,
  type SpellSchool,
  type TargetingType,
  type UpcastScaling,
} from "./content/spells";

// Events
export { InMemoryEventStore } from "./events/store";
export type { EventStore } from "./events/store";
export type {
  DraftEvent,
  EngineEvent,
  EngineEventType,
  EventMeta,
} from "./events/types";

// Projections
export {
  applyEvent,
  emptyWorldState,
  rebuild,
  type WorldState,
} from "./projections/world-state";

// Commands
export { handleCommand } from "./commands/handlers";
export { CampaignCommandQueue } from "./commands/queue";
export type { CommandExecutor } from "./commands/queue";
export type { ExecutionContext, RollFn, RollOutcome } from "./commands/context";
export {
  reject,
  type ApplyDamageCommand,
  type ApplyHealingCommand,
  type ChangeSceneCommand,
  type Command,
  type CommandResult,
  type CommandSummary,
  type CommandType,
  type CreateEntityCommand,
  type CreateSceneCommand,
  type DamageSource,
  type MoveEntityCommand,
  type RollDiceCommand,
  type ValidationCode,
  type ValidationFailure,
} from "./commands/types";

// Fixtures
export {
  buildCharacterSheet,
  buildFixtureCampaign,
  FIXTURE_CHARACTERS,
} from "./fixtures/party";
export type {
  CharacterSheet,
  CharacterSheetInput,
  FixtureCharacter,
  SavingThrow,
} from "./fixtures/party";
