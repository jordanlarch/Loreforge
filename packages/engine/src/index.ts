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
  attackRollBonusDice,
  effectiveAc,
  huntersMarkOn,
  type ActiveEffect,
  type EffectModifier,
} from "./combat/effects";
export {
  chebyshev,
  CONE_HALF_ANGLE_COS,
  distanceFeet,
  FEET_PER_CELL,
  hasLineOfSight,
  lineCells,
  withinBurst,
  withinCone,
  withinCube,
  withinLine,
  lineEndpoint,
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
  export { areHostile, opportunityAttackReach, provokesOpportunityAttack, REACH_FEET, readyTriggerRangeFeet } from "./combat/reactions";
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
  applyAsi,
  ASI_LEVELS,
  type AsiChoice,
  baseArmorClass,
  featureStubsForLevel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  isValidAsiChoice,
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
  spellcastingAbilityForClasses,
  CLASS_SPELLCASTING_ABILITY,
  STANDARD_ARRAY,
  totalPointBuyCost,
  xpForLevel,
  XP_THRESHOLDS,
  xpProgress,
  type HpMethod,
  type Skill,
} from "./entities/character-build";
export {
  accumulatedClassFeatures,
  classFeaturesForLevel,
  type ClassFeature,
} from "./entities/class-features";
export {
  FIGHTING_STYLES,
  fightingStylePickLevel,
  needsFightingStylePick,
  needsSubclassPick,
  subclassOptionsFor,
  subclassPickLevel,
  SUBCLASS_OPTIONS,
  type FightingStyle,
} from "./entities/class-choices";
export {
  featureRechargeMap,
  featureResourceKey,
  refreshResourceUsesOnRest,
  remainingFeatureUses,
  spendFeatureUse,
} from "./entities/feature-resources";

export {
  buildStartingCharacterStats,
  type LevelAdvanceChoice,
} from "./entities/character-advancement";

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
  type SpellAppliedEffect,
  type SpellDuration,
  type SpellLevel,
  type SpellProjectiles,
  type SpellRange,
  type SpellSchool,
  type TargetingType,
  type UpcastScaling,
} from "./content/spells";
export { open5eRawToSpellDefinition } from "./content/open5e-spell";
export {
  MONSTER_TEMPLATES,
  MONSTER_TEMPLATE_LIST,
  monsterTemplate,
  type MonsterTemplate,
} from "./content/monsters";
export {
  meleeReachFromEquipment,
  meleeReachFromWeaponName,
} from "./content/weapons";
export { fullCasterSlots } from "./content/spell-slots";
export {
  multiclassCasterLevel,
  sheetSlotPoolsFromClasses,
  spellSlotsForClasses,
} from "./content/multiclass-spell-slots";
export {
  warlockLevelFromClasses,
  warlockPactMagic,
  type PactMagicPool,
} from "./content/warlock-pact-slots";
export { getSpell, SPELL_REGISTRY } from "./content/spell-registry";
export { isSpellPrepared, spellNameToId } from "./content/spell-id";
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
  type EndEncounterCommand,
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
export {
  arrivalNarrationForLocation,
  buildCampaignExplorationCommands,
  firstDungeonRoom,
  buildDungeonCombatStartCommands,
  buildDungeonEntryCommands,
  buildEnterLocationCommands,
  buildLocationNpcCommands,
  DEFAULT_STARTING_LOCATION,
  entityIdFromSceneId,
  extractOpeningHookText,
  isExplorableRealmType,
  matchTravelDestination,
  openingNarrationForLocation,
  realmNpcEntityId,
  resolveDungeonFoes,
  sceneIdForRealmEntity,
  type CampaignStartingLocation,
  type ExplorableRealmType,
  type LocationNpcSpec,
  type OpeningHookOptions,
} from "./fixtures/exploration";
export {
  formatQuestTeaseLine,
  enrichEntityDataWithQuests,
  inheritQuestDataFromParent,
  locationHasQuestContent,
  migrateHookStringToTemplate,
  normalizeEntityQuests,
  resolveQuestTeaseText,
  resolveQuestTeaseTextWithInheritance,
  defaultTracerTriggers,
  buildQuestInstanceDataFromTemplate,
  parseQuestInstanceData,
  snapshotQuestTemplate,
  templateFromInstance,
  buildActiveQuestHotContext,
  formatQuestBriefingLine,
  formatQuestOfferLine,
  markBriefingDelivered,
  pendingQuestBriefings,
  playerTextReferencesNpc,
  resolveQuestOfferForNpc,
  QUEST_TRIGGER_TYPES,
  QUEST_TAGS,
  evaluateQuestPrerequisites,
  advanceQuestStep,
  branchChoicesForStep,
  resolveNextStepId,
  buildRewardsGranted,
  formatQuestResolveRewardsLine,
  backfillQuestInstanceData,
  backfillTemplateFromLegacyRow,
  type QuestDelivery,
  type QuestInstanceData,
  type QuestInstanceRef,
  type QuestInstanceStatus,
  type QuestPrerequisiteContext,
  type QuestRewards,
  type QuestRewardsGranted,
  type QuestStep,
  type QuestTag,
  type QuestTeaseTrigger,
  type QuestTemplate,
  type QuestTrigger,
  type QuestTriggerType,
} from "./quests";
export {
  ENCOUNTER_MAP_PRESETS,
  ENCOUNTER_MAP_PRESET_LIST,
  resolveEncounterMap,
  type EncounterMapDef,
  type EncounterMapPresetId,
} from "./fixtures/battle-maps";
export {
  buildPartyMemberJoinCommands,
  findPartyJoinPosition,
  partyMemberToEntityInit,
} from "./fixtures/party-join";
export type {
  CharacterSheet,
  CharacterSheetInput,
  FixtureCharacter,
  SavingThrow,
  SkillRow,
} from "./fixtures/party";
export {
  buildCompanionCommands,
  buildTutorialSeedCommands,
  classifyScene2Topic,
  nextTutorialScene,
  tutorialAchievement,
  tutorialBeat,
  tutorialRelightPath,
  tutorialScene,
  TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
  TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
  TUTORIAL_ACHIEVEMENTS,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_NPC_BARNABY_ID,
  TUTORIAL_NPC_LILY_ID,
  TUTORIAL_NPC_MARLOWE_ID,
  TUTORIAL_NPC_TORIC_ID,
  createTutorialNpcCommands,
  buildTutorialSceneRepairCommands,
  resolveTutorialLeadEntityId,
  tutorialScenePlacement,
  tutorialSceneRequiresCompanion,
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
  TUTORIAL_SCENE1_VILLAGE_ROW,
  TUTORIAL_SCENE_SPIRE_LOWER,
  TUTORIAL_SCENE_SPIRE_STAIR,
  TUTORIAL_SCENE_SPIRE_UPPER,
  TUTORIAL_SHADE_ID,
  TUTORIAL_SCRIPT,
  TUTORIAL_WRAP,
  type PartyMemberLike,
  type Scene2Topic,
  type TutorialAchievement,
  type TutorialCheck,
  type TutorialDialogueBeat,
  type TutorialLootItem,
  type TutorialRelightPath,
  type TutorialRelightPathId,
  type TutorialResolution,
  TUTORIAL_ATTACK_ALLY_DEFLECT,
  TUTORIAL_LEAVE_VILLAGE_RAIL,
  TUTORIAL_SCENE_HINTS,
  classifyTutorialLeaveIntent,
  classifyTutorialRelightIntent,
  isTutorialFriendlyFireTarget,
  tutorialChatFallback,
  tutorialHintForScene,
  tutorialScene1VillageReached,
  type TutorialSceneHint,
  type TutorialSceneScript,
  type TutorialWrap,
} from "./fixtures/tutorial";
