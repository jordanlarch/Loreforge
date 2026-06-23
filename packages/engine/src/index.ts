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
  attacksPerAction,
  createEntityState,
  extraAttackCount,
  proficiencyBonusForLevel,
  totalLevel,
} from "./entities/abilities";
export {
  ABILITIES,
  type Ability,
  type AbilityScores,
  type ActionEconomyState,
  type ClassLevel,
  type ConcentrationState,
  type DeathSaveTally,
  type EntityInit,
  type EntityKind,
  type EntityRef,
  type EntityState,
  type GridPosition,
  type HitPoints,
  type ReadiedAction,
  type ReadyState,
  type ResourceState,
  type SceneId,
  type SceneMap,
  type SceneState,
  type SpellcastingInit,
  type SpellcastingState,
  type SpellSlots,
  type SpellSlotState,
} from "./entities/types";

// Combat
export {
  freshActionEconomy,
  sortInitiative,
  type InitiativeEntry,
  type InitiativeRollInput,
} from "./combat/initiative";
export {
  criticalNotation,
  resolveHit,
  type HitResolution,
} from "./combat/attack";
export {
  chebyshev,
  CONE_HALF_ANGLE_COS,
  distanceFeet,
  FEET_PER_CELL,
  hasLineOfSight,
  lineCells,
  withinBurst,
  withinCone,
} from "./combat/grid";
export {
  attackedMode,
  charmedSources,
  combineMode,
  CONDITIONS,
  critsWhenAdjacent,
  effectiveSpeed,
  EXHAUSTION_MAX,
  isCondition,
  isIncapacitated,
  isProne,
  ownAttackMode,
  saveResolution,
  type Condition,
  type ConditionState,
  type RollAdjust,
} from "./combat/conditions";
export {
  concentrationDC,
  resolveDeathSave,
  type DeathSaveResolution,
  type DeathSaveTally as DeathSaveTallyInput,
} from "./combat/death";
export { areHostile, provokesOpportunityAttack, REACH_FEET } from "./combat/reactions";
export {
  ENCOUNTER_XP_THRESHOLDS,
  encounterMultiplier,
  partyThresholds,
  rateEncounter,
  type EncounterDifficulty,
  type EncounterRating,
  type XpThresholds,
} from "./combat/encounter-budget";
export {
  applyAbilityBonuses,
  ASI_LEVELS,
  baseArmorClass,
  featureStubsForLevel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  isValidPointBuy,
  levelForXp,
  levelUpSeed,
  MANUAL_MAX,
  MANUAL_MIN,
  MAX_CHARACTER_LEVEL,
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
  xpForLevel,
  XP_THRESHOLDS,
  xpProgress,
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
  type SpellProjectiles,
  type SpellRange,
  type SpellSchool,
  type TargetingType,
  type UpcastScaling,
} from "./content/spells";
export {
  MONSTER_TEMPLATES,
  MONSTER_TEMPLATE_LIST,
  monsterTemplate,
  type MonsterTemplate,
} from "./content/monsters";
export { fullCasterSlots } from "./content/spell-slots";
export { getSpell, SPELL_REGISTRY } from "./content/spell-registry";
export {
  cantripDamageDice,
  spellAttackBonus,
  spellcastingModifier,
  spellSaveDC,
} from "./content/spellcasting";

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
  type EncounterState,
  type WorldState,
} from "./projections/world-state";

// Commands
export { handleCommand } from "./commands/handlers";
export { CampaignCommandQueue } from "./commands/queue";
export type { CommandExecutor } from "./commands/queue";
export type { ExecutionContext, RollFn, RollOutcome } from "./commands/context";
export {
  reject,
  type AbilityCheckCommand,
  type ApplyConditionCommand,
  type ApplyDamageCommand,
  type ApplyHealingCommand,
  type AttackCommand,
  type CastSpellCommand,
  type ChangeSceneCommand,
  type Command,
  type CommandResult,
  type CommandSummary,
  type CommandType,
  type CreateEntityCommand,
  type CreateSceneCommand,
  type DamageSource,
  type EndTurnCommand,
  type MoveEntityCommand,
  type RemoveConditionCommand,
  type RollDiceCommand,
  type RollInitiativeCommand,
  type SavingThrowCommand,
  type StartEncounterCommand,
  type ValidationCode,
  type ValidationFailure,
} from "./commands/types";

// Fixtures
export {
  buildCharacterSheet,
  buildFixtureCampaign,
  FIXTURE_CHARACTERS,
} from "./fixtures/party";
export {
  buildFixtureBattle,
  buildPartyBattleCommands,
  FIXTURE_BATTLE_CAMPAIGN_ID,
  FIXTURE_BATTLE_COMMANDS,
  FIXTURE_BATTLE_FOES_SIDE,
  FIXTURE_BATTLE_PARTY_SIDE,
  FIXTURE_BATTLE_SCENE_ID,
  FIXTURE_PARTY,
  MAX_BATTLE_PARTY,
  MAX_BATTLE_FOES,
  attackAction,
  castAction,
  checkAction,
  expandEncounterFoes,
  moveAction,
  opportunityAttackAction,
  readyAction,
  triggerReadiedAction,
  type BattleAction,
  type FoeSpec,
  type PartyMember,
} from "./fixtures/battle";
export type {
  CharacterSheet,
  CharacterSheetInput,
  FixtureCharacter,
  SavingThrow,
} from "./fixtures/party";
export {
  buildCompanionCommands,
  buildTutorialSeedCommands,
  classifyScene2Topic,
  nextTutorialScene,
  tutorialBeat,
  tutorialRelightPath,
  tutorialScene,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_FOES_SIDE,
  TUTORIAL_HOOK,
  TUTORIAL_OIL_NAME,
  TUTORIAL_PARTY_SIDE,
  TUTORIAL_PC_NAME,
  TUTORIAL_RESOLUTION,
  TUTORIAL_SCENE2_BEATS,
  TUTORIAL_SCENE_CROOKED_LANE,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE_SPIRE_LOWER,
  TUTORIAL_SCENE_SPIRE_STAIR,
  TUTORIAL_SCENE_SPIRE_UPPER,
  TUTORIAL_SHADE_ID,
  TUTORIAL_SCRIPT,
  type PartyMemberLike,
  type Scene2Topic,
  type TutorialCheck,
  type TutorialDialogueBeat,
  type TutorialLootItem,
  type TutorialRelightPath,
  type TutorialRelightPathId,
  type TutorialResolution,
  type TutorialSceneScript,
} from "./fixtures/tutorial";
