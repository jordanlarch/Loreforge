/**
 * Engine event model (E1 subset).
 *
 * Every state mutation is an immutable, append-only event. Projections are pure
 * derivations of the event log (see `../projections`). This file defines the
 * small set of event types the skeleton needs; the full ~50-type taxonomy in
 * `docs/engine/architecture.md` §3.1 is added incrementally in later phases.
 */
import type {
  EntityInit,
  EntityRef,
  GridPosition,
  ReadiedAction,
  SceneId,
  SceneState,
} from "../entities/types";
import type { InitiativeEntry } from "../combat/initiative";
import type { Condition } from "../combat/conditions";
import type { ActiveEffect } from "../combat/effects";
import type { Ability } from "../entities/types";
import type { RollMode } from "../rng/dice";

/** Common envelope fields stamped on every persisted event. */
export type EventMeta = {
  /** Monotonic per-campaign sequence number (1-based). */
  sequence: number;
  campaignId: string;
  /** Server epoch ms. */
  timestamp: number;
  /** Command that produced this event. */
  causedByCommandId: string;
  /** Who caused it (entity ref, "ai", or "system"). */
  actor?: EntityRef | "ai" | "system";
};

export type EntityCreatedPayload = { entity: EntityInit };

export type SceneCreatedPayload = { scene: SceneState };

export type SceneChangedPayload = { sceneId: SceneId };

export type DiceRolledPayload = {
  notation: string;
  rolls: number[];
  total: number;
  /** RNG scope used (for audit/replay). */
  scope: string;
  /** Draw index within the scope's stream. */
  drawIndex: number;
};

export type DamageDealtPayload = {
  target: EntityRef;
  amount: number;
  damageType: string;
  hpBefore: number;
  hpAfter: number;
  /** When true, damage at 0 HP counts as two death-save failures. */
  critical?: boolean;
};

export type HealingAppliedPayload = {
  target: EntityRef;
  amount: number;
  hpBefore: number;
  hpAfter: number;
};

export type TempHpGrantedPayload = {
  target: EntityRef;
  amount: number;
  tempBefore: number;
  tempAfter: number;
};

export type EntityMovedPayload = {
  entity: EntityRef;
  from?: GridPosition;
  to: GridPosition;
};

export type EntityRelocatedPayload = {
  entity: EntityRef;
  sceneId: SceneId;
  position?: GridPosition;
};

export type EncounterStartedPayload = {
  sceneId: SceneId;
  combatants: EntityRef[];
  /** Per-combatant side/team id; omitted combatants are neutral. */
  sides: Record<EntityRef, string>;
};

export type EncounterEndedPayload = {
  sceneId: SceneId;
  combatants: EntityRef[];
};

export type InitiativeRolledPayload = {
  /** Combatants in resolved descending turn order. */
  order: InitiativeEntry[];
};

export type SurpriseResolvedPayload = {
  /** Combatants surprised at the start of this encounter. */
  surprised: EntityRef[];
};

export type CombatantAddedPayload = {
  entityId: EntityRef;
  side: string;
  /** Full initiative order after inserting the newcomer. */
  order: InitiativeEntry[];
  /** Preserved active turn index after the resort. */
  activeIndex: number;
};

export type TurnStartedPayload = {
  entity: EntityRef;
  /** Index of this combatant within the initiative order. */
  index: number;
};

export type TurnEndedPayload = {
  entity: EntityRef;
};

export type RoundAdvancedPayload = {
  round: number;
};

export type AttackResolvedPayload = {
  attacker: EntityRef;
  target: EntityRef;
  attackRoll: { natural: number; total: number; mode: RollMode };
  targetAc: number;
  hit: boolean;
  critical: boolean;
  damageType: string;
  /** Damage dealt on a hit; omitted on a miss. */
  damage?: number;
  /** Extra Sneak Attack damage included in `damage`. */
  sneakAttackDamage?: number;
  /** Extra Colossus Slayer damage included in `damage`. */
  colossusSlayerDamage?: number;
  /** Whether a Bardic Inspiration die was added to the attack roll. */
  bardicInspirationUsed?: boolean;
  /** Stunning Strike attempted on this hit. */
  stunningStrike?: boolean;
  /** Target failed Stunning Strike save and is Stunned. */
  targetStunned?: boolean;
};

export type ConditionAppliedPayload = {
  target: EntityRef;
  condition: Condition;
  source?: EntityRef;
  level?: number;
  concentrationSpell?: string;
  concentrationHolder?: EntityRef;
};

export type ConditionRemovedPayload = {
  target: EntityRef;
  condition: Condition;
};

export type SaveRolledPayload = {
  entity: EntityRef;
  ability: Ability;
  dc: number;
  mode: RollMode;
  /** Natural d20 face; omitted on an auto-fail (no roll consumed). */
  natural?: number;
  /** d20 + ability modifier; omitted on an auto-fail. */
  total?: number;
  success: boolean;
  autoFail: boolean;
  /** Whether the entity's proficiency bonus was added. */
  proficient?: boolean;
  /** Indomitable reroll — do not open another Indomitable window. */
  indomitableReroll?: boolean;
};

export type CheckRolledPayload = {
  entity: EntityRef;
  ability: Ability;
  /** Skill/tool name for display (e.g. "Perception"); omitted for a raw check. */
  skill?: string;
  /** Difficulty class, when contested; omitted for an uncontested roll. */
  dc?: number;
  mode: RollMode;
  /** Natural d20 face. */
  natural: number;
  /** d20 + ability modifier (+ proficiency when applicable). */
  total: number;
  /** Whether the entity's proficiency bonus was added. */
  proficient: boolean;
  /** Pass/fail; present only when a `dc` was supplied. */
  success?: boolean;
  /** Blinded auto-fail and similar — no d20 was rolled. */
  autoFail?: boolean;
};

export type DeathSaveRolledPayload = {
  entity: EntityRef;
  natural: number;
  mode: RollMode;
  /** Resulting tally after this roll. */
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
  /** Natural 20 — regained 1 HP. */
  revived: boolean;
};

export type RestedPayload = {
  entity: EntityRef;
  kind: "short" | "long";
};

export type ConcentrationStartedPayload = {
  entity: EntityRef;
  spell: string;
};

export type ConcentrationBrokenPayload = {
  entity: EntityRef;
  reason: "damage" | "ended" | "incapacitated" | "downed" | "recast";
};

export type EffectAppliedPayload = {
  target: EntityRef;
  effect: ActiveEffect;
};

export type EffectRemovedPayload = {
  target: EntityRef;
  effectId: string;
};

/** Decrement `remainingRounds` on all timed effects (combat round boundary). */
export type EffectsDurationTickedPayload = Record<string, never>;

export type TrapDetectedPayload = {
  sceneId: SceneId;
  trapInstanceId: string;
  trapSlug: string;
  detector: EntityRef;
  success: boolean;
};

export type TrapDisabledPayload = {
  sceneId: SceneId;
  trapInstanceId: string;
  trapSlug: string;
  disabler: EntityRef;
  success: boolean;
};

export type TrapTriggeredPayload = {
  sceneId: SceneId;
  trapInstanceId: string;
  trapSlug: string;
  victim: EntityRef;
  /** True when structured save/damage/conditions were applied by the engine. */
  resolved: boolean;
};

export type WeaponCoatedPayload = {
  entity: EntityRef;
  poisonSlug: string;
};

export type PoisonCoatingClearedPayload = {
  entity: EntityRef;
};

export type PoisonAppliedPayload = {
  target: EntityRef;
  instanceId: string;
  poisonSlug: string;
  pendingRepeat: boolean;
  source?: EntityRef;
};

export type PoisonRemovedPayload = {
  target: EntityRef;
  instanceId: string;
  poisonSlug: string;
  reason: "saved" | "cured" | "expired";
};

export type PoisonRepeatProgressedPayload = {
  target: EntityRef;
  instanceId: string;
  poisonSlug: string;
  repeatSuccesses: number;
};

export type PoisonTickResolvedPayload = {
  target: EntityRef;
  instanceId: string;
  poisonSlug: string;
  success: boolean;
  damage?: number;
  maxHpReduced?: number;
};

export type MaxHpReducedPayload = {
  target: EntityRef;
  amount: number;
  hpMaxBefore: number;
  hpMaxAfter: number;
};

export type CurseAppliedPayload = {
  target: EntityRef;
  instanceId: string;
  curseSlug: string;
  pendingRecovery: boolean;
};

export type CurseRemovedPayload = {
  target: EntityRef;
  instanceId: string;
  curseSlug: string;
  reason: "saved" | "removed" | "cured";
};

export type CurseTickResolvedPayload = {
  target: EntityRef;
  instanceId: string;
  curseSlug: string;
  success: boolean;
};

export type SceneEnvironmentalEffectsSetPayload = {
  sceneId: SceneId;
  slugs: string[];
};

export type EnvironmentalEffectAppliedPayload = {
  target: EntityRef;
  instanceId: string;
  effectSlug: string;
  pendingRepeat: boolean;
};

export type EnvironmentalEffectRemovedPayload = {
  target: EntityRef;
  instanceId: string;
  effectSlug: string;
  reason: "saved" | "removed";
};

export type EnvironmentalEffectTickResolvedPayload = {
  target: EntityRef;
  instanceId: string;
  effectSlug: string;
  success: boolean;
};

export type FearStressAppliedPayload = {
  target: EntityRef;
  instanceId: string;
  fearStressSlug: string;
  pendingRepeat: boolean;
  boundSceneId?: SceneId;
};

export type FearStressRemovedPayload = {
  target: EntityRef;
  instanceId: string;
  fearStressSlug: string;
  reason: "saved" | "removed";
};

export type FearStressTickResolvedPayload = {
  target: EntityRef;
  instanceId: string;
  fearStressSlug: string;
  success: boolean;
};

export type BurningAppliedPayload = {
  target: EntityRef;
  instanceId: string;
  burningSlug: string;
  pendingRepeat: boolean;
};

export type BurningRemovedPayload = {
  target: EntityRef;
  instanceId: string;
  burningSlug: string;
  reason: "action" | "saved";
};

export type BurningTickResolvedPayload = {
  target: EntityRef;
  instanceId: string;
  burningSlug: string;
  damage: number;
};

export type ReactionWindowOpenedPayload = {
  trigger: "leave_reach";
  /** The creature whose movement opened the window. */
  mover: EntityRef;
  /** Combatants who threatened the mover and still have a reaction available. */
  eligible: EntityRef[];
  /** Mover's last square still within reach — used for OA range/LOS. */
  moverAtProvocation: GridPosition;
};

export type ReactionTakenPayload = {
  reactor: EntityRef;
  trigger: "opportunity_attack" | "readied" | "spell" | "cutting_words";
};

export type ActionReadiedPayload = {
  entity: EntityRef;
  trigger: string;
  action: ReadiedAction;
};

export type ReadiedActionTriggeredPayload = {
  entity: EntityRef;
};

/**
 * A turn resource was spent by the active combatant (arch §5.1). Emitted by the
 * Attack action and action-cost spells so the projection debits the economy.
 * `action` marks the single action spent; `attack` increments the Attack
 * action's attack budget (one per weapon attack, including Extra Attack /
 * Multiattack continuations).
 */
export type ActionSpentPayload = {
  entity: EntityRef;
  action?: boolean;
  attack?: boolean;
  bonusAction?: boolean;
  /** Rogue Sneak Attack consumed for this turn. */
  sneakAttack?: boolean;
  /** Hunter Colossus Slayer consumed for this turn. */
  colossusSlayer?: boolean;
  /** Monk Flurry of Blows — grant bonus unarmed strikes (activation). */
  flurryAttacksGranted?: number;
  /** Monk Flurry of Blows — consume one granted strike. */
  flurryAttack?: boolean;
  /** Monk Stunning Strike consumed for this turn. */
  stunningStrike?: boolean;
};

export type FeaturePoolSpentPayload = {
  entity: EntityRef;
  featureKey: string;
  resourceUses: boolean[];
};

export type DashMovementGrantedPayload = {
  entity: EntityRef;
  bonusFeet: number;
};

export type DisengagedPayload = {
  entity: EntityRef;
};

export type DodgingStartedPayload = {
  entity: EntityRef;
};

export type SpellCastPayload = {
  caster: EntityRef;
  spellId: string;
  spellName: string;
  /** Slot level spent (0 for a cantrip). */
  slotLevel: number;
  /** Affected creatures (one entry per dart for a projectile spell). */
  targets: EntityRef[];
  /** True when the cast used the caster's bonus action (consumed in combat). */
  bonusAction?: boolean;
  /** Metamagic option applied (Empowered, Heightened, …). */
  metamagic?: string;
  /** Extra Sorcery Points spent on Metamagic. */
  sorceryPointsSpent?: number;
};

export type SpellSlotExpendedPayload = {
  entity: EntityRef;
  slotLevel: number;
};

export type SpellSlotsRestoredPayload = {
  entity: EntityRef;
};

export type SpellSlotRecoveredPayload = {
  entity: EntityRef;
  slotLevel: number;
};

export type CuttingWordsAppliedPayload = {
  reactor: EntityRef;
  against: EntityRef;
  mode: "attack" | "damage" | "check";
  die: string;
  penalty: number;
  originalTotal: number;
  adjustedTotal: number;
  /** Present when mode is attack. */
  hit?: boolean;
};

export type FastHandsUsedPayload = {
  entity: EntityRef;
  action: "sleight_of_hand" | "thieves_tools" | "use_object";
};

export type OpenHandTechniqueAppliedPayload = {
  attacker: EntityRef;
  target: EntityRef;
  technique: "prone" | "push" | "no_reactions";
};

export type PendingAttackStagedPayload = {
  cmd: import("../commands/types").AttackCommand;
  natural: number;
  total: number;
  targetAc: number;
  hit: boolean;
  critical: boolean;
  mode: RollMode;
  hadBardicInspiration: boolean;
  eligible: EntityRef[];
  declined: EntityRef[];
  spendsAction: boolean;
  spendsBonusAction: boolean;
  spendsFlurryAttack: boolean;
  viaReaction?: boolean;
  targetPosition?: GridPosition;
};

export type PendingAttackUpdatedPayload = {
  declined: EntityRef[];
};

export type ActionSurgeGrantedPayload = {
  entity: EntityRef;
};

export type PendingSpellCastStagedPayload = {
  cmd: import("../commands/types").CastSpellCommand;
  slotLevel: number;
  eligible: EntityRef[];
  declined: EntityRef[];
};

export type PendingSpellCastUpdatedPayload = {
  declined: EntityRef[];
};

export type SpellCastCancelledPayload = {
  caster: EntityRef;
  spellId: string;
  spellName: string;
  counteredBy: EntityRef;
};

export type CreatureRevivedPayload = {
  target: EntityRef;
  caster: EntityRef;
  hp: number;
};

export type PendingIndomitableResolvedPayload = {
  entity: EntityRef;
};

export type SpiritualWeaponSummonedPayload = {
  caster: EntityRef;
  slotLevel: number;
  instanceId: string;
  roundsRemaining: number;
};

export type SpiritualWeaponTickedPayload = {
  caster: EntityRef;
  instanceId: string;
  roundsRemaining: number;
};

export type SpiritualWeaponDismissedPayload = {
  caster: EntityRef;
  instanceId: string;
};

export type SpiritGuardiansStartedPayload = {
  caster: EntityRef;
  slotLevel: number;
  instanceId: string;
};

export type SpellZoneCreatedPayload = {
  sceneId: SceneId;
  instanceId: string;
  spellId: string;
  caster: EntityRef;
  slotLevel: number;
  origin: import("../entities/types").GridPosition;
  cells: import("../entities/types").GridPosition[];
};

export type SpellZoneRemovedPayload = {
  sceneId: SceneId;
  instanceId: string;
};

export type PolymorphAppliedPayload = {
  target: EntityRef;
  caster: EntityRef;
  beastSlug: string;
  beastName: string;
  beastAbilityScores: import("../entities/types").AbilityScores;
  beastMaxHp: number;
  beastAc: number;
  beastSpeed: number;
  storedAbilityScores: import("../entities/types").AbilityScores;
  storedMaxHp: number;
  storedBaseAc: number;
  storedSpeed: number;
  storedHpCurrent: number;
};

export type PolymorphEndedPayload = {
  target: EntityRef;
  reason: "concentration" | "zero_hp";
};

/** Discriminated union of all engine events. */
export type EngineEvent =
  | (EventMeta & { type: "EntityCreated"; payload: EntityCreatedPayload })
  | (EventMeta & { type: "SceneCreated"; payload: SceneCreatedPayload })
  | (EventMeta & { type: "SceneChanged"; payload: SceneChangedPayload })
  | (EventMeta & { type: "DiceRolled"; payload: DiceRolledPayload })
  | (EventMeta & { type: "DamageDealt"; payload: DamageDealtPayload })
  | (EventMeta & { type: "HealingApplied"; payload: HealingAppliedPayload })
  | (EventMeta & { type: "TempHpGranted"; payload: TempHpGrantedPayload })
  | (EventMeta & { type: "EntityMoved"; payload: EntityMovedPayload })
  | (EventMeta & {
      type: "EntityRelocated";
      payload: EntityRelocatedPayload;
    })
  | (EventMeta & { type: "EncounterStarted"; payload: EncounterStartedPayload })
  | (EventMeta & { type: "EncounterEnded"; payload: EncounterEndedPayload })
  | (EventMeta & { type: "InitiativeRolled"; payload: InitiativeRolledPayload })
  | (EventMeta & { type: "SurpriseResolved"; payload: SurpriseResolvedPayload })
  | (EventMeta & { type: "CombatantAdded"; payload: CombatantAddedPayload })
  | (EventMeta & { type: "TurnStarted"; payload: TurnStartedPayload })
  | (EventMeta & { type: "TurnEnded"; payload: TurnEndedPayload })
  | (EventMeta & { type: "RoundAdvanced"; payload: RoundAdvancedPayload })
  | (EventMeta & { type: "AttackResolved"; payload: AttackResolvedPayload })
  | (EventMeta & { type: "ConditionApplied"; payload: ConditionAppliedPayload })
  | (EventMeta & { type: "ConditionRemoved"; payload: ConditionRemovedPayload })
  | (EventMeta & { type: "SaveRolled"; payload: SaveRolledPayload })
  | (EventMeta & { type: "CheckRolled"; payload: CheckRolledPayload })
  | (EventMeta & { type: "DeathSaveRolled"; payload: DeathSaveRolledPayload })
  | (EventMeta & { type: "Rested"; payload: RestedPayload })
  | (EventMeta & {
      type: "ConcentrationStarted";
      payload: ConcentrationStartedPayload;
    })
  | (EventMeta & {
      type: "ConcentrationBroken";
      payload: ConcentrationBrokenPayload;
    })
  | (EventMeta & {
      type: "ReactionWindowOpened";
      payload: ReactionWindowOpenedPayload;
    })
  | (EventMeta & { type: "ReactionTaken"; payload: ReactionTakenPayload })
  | (EventMeta & { type: "ActionReadied"; payload: ActionReadiedPayload })
  | (EventMeta & { type: "ActionSpent"; payload: ActionSpentPayload })
  | (EventMeta & {
      type: "FeaturePoolSpent";
      payload: FeaturePoolSpentPayload;
    })
  | (EventMeta & { type: "DashMovementGranted"; payload: DashMovementGrantedPayload })
  | (EventMeta & { type: "Disengaged"; payload: DisengagedPayload })
  | (EventMeta & { type: "DodgingStarted"; payload: DodgingStartedPayload })
  | (EventMeta & {
      type: "ReadiedActionTriggered";
      payload: ReadiedActionTriggeredPayload;
    })
  | (EventMeta & { type: "SpellCast"; payload: SpellCastPayload })
  | (EventMeta & {
      type: "SpellSlotExpended";
      payload: SpellSlotExpendedPayload;
    })
  | (EventMeta & {
      type: "SpellSlotsRestored";
      payload: SpellSlotsRestoredPayload;
    })
  | (EventMeta & {
      type: "SpellSlotRecovered";
      payload: SpellSlotRecoveredPayload;
    })
  | (EventMeta & {
      type: "CuttingWordsApplied";
      payload: CuttingWordsAppliedPayload;
    })
  | (EventMeta & { type: "FastHandsUsed"; payload: FastHandsUsedPayload })
  | (EventMeta & {
      type: "OpenHandTechniqueApplied";
      payload: OpenHandTechniqueAppliedPayload;
    })
  | (EventMeta & {
      type: "PendingAttackStaged";
      payload: PendingAttackStagedPayload;
    })
  | (EventMeta & {
      type: "PendingAttackUpdated";
      payload: PendingAttackUpdatedPayload;
    })
  | (EventMeta & {
      type: "ActionSurgeGranted";
      payload: ActionSurgeGrantedPayload;
    })
  | (EventMeta & {
      type: "PendingSpellCastStaged";
      payload: PendingSpellCastStagedPayload;
    })
  | (EventMeta & {
      type: "PendingSpellCastUpdated";
      payload: PendingSpellCastUpdatedPayload;
    })
  | (EventMeta & {
      type: "SpellCastCancelled";
      payload: SpellCastCancelledPayload;
    })
  | (EventMeta & {
      type: "CreatureRevived";
      payload: CreatureRevivedPayload;
    })
  | (EventMeta & {
      type: "PendingIndomitableResolved";
      payload: PendingIndomitableResolvedPayload;
    })
  | (EventMeta & {
      type: "SpiritualWeaponSummoned";
      payload: SpiritualWeaponSummonedPayload;
    })
  | (EventMeta & {
      type: "SpiritualWeaponTicked";
      payload: SpiritualWeaponTickedPayload;
    })
  | (EventMeta & {
      type: "SpiritualWeaponDismissed";
      payload: SpiritualWeaponDismissedPayload;
    })
  | (EventMeta & {
      type: "SpiritGuardiansStarted";
      payload: SpiritGuardiansStartedPayload;
    })
  | (EventMeta & {
      type: "SpellZoneCreated";
      payload: SpellZoneCreatedPayload;
    })
  | (EventMeta & {
      type: "SpellZoneRemoved";
      payload: SpellZoneRemovedPayload;
    })
  | (EventMeta & {
      type: "PolymorphApplied";
      payload: PolymorphAppliedPayload;
    })
  | (EventMeta & {
      type: "PolymorphEnded";
      payload: PolymorphEndedPayload;
    })
  | (EventMeta & { type: "EffectApplied"; payload: EffectAppliedPayload })
  | (EventMeta & { type: "EffectRemoved"; payload: EffectRemovedPayload })
  | (EventMeta & {
      type: "EffectsDurationTicked";
      payload: EffectsDurationTickedPayload;
    })
  | (EventMeta & { type: "TrapDetected"; payload: TrapDetectedPayload })
  | (EventMeta & { type: "TrapDisabled"; payload: TrapDisabledPayload })
  | (EventMeta & { type: "TrapTriggered"; payload: TrapTriggeredPayload })
  | (EventMeta & { type: "WeaponCoated"; payload: WeaponCoatedPayload })
  | (EventMeta & { type: "PoisonCoatingCleared"; payload: PoisonCoatingClearedPayload })
  | (EventMeta & { type: "PoisonApplied"; payload: PoisonAppliedPayload })
  | (EventMeta & { type: "PoisonRemoved"; payload: PoisonRemovedPayload })
  | (EventMeta & {
      type: "PoisonRepeatProgressed";
      payload: PoisonRepeatProgressedPayload;
    })
  | (EventMeta & { type: "PoisonTickResolved"; payload: PoisonTickResolvedPayload })
  | (EventMeta & { type: "MaxHpReduced"; payload: MaxHpReducedPayload })
  | (EventMeta & { type: "CurseApplied"; payload: CurseAppliedPayload })
  | (EventMeta & { type: "CurseRemoved"; payload: CurseRemovedPayload })
  | (EventMeta & { type: "CurseTickResolved"; payload: CurseTickResolvedPayload })
  | (EventMeta & {
      type: "SceneEnvironmentalEffectsSet";
      payload: SceneEnvironmentalEffectsSetPayload;
    })
  | (EventMeta & {
      type: "EnvironmentalEffectApplied";
      payload: EnvironmentalEffectAppliedPayload;
    })
  | (EventMeta & {
      type: "EnvironmentalEffectRemoved";
      payload: EnvironmentalEffectRemovedPayload;
    })
  | (EventMeta & {
      type: "EnvironmentalEffectTickResolved";
      payload: EnvironmentalEffectTickResolvedPayload;
    })
  | (EventMeta & { type: "FearStressApplied"; payload: FearStressAppliedPayload })
  | (EventMeta & { type: "FearStressRemoved"; payload: FearStressRemovedPayload })
  | (EventMeta & {
      type: "FearStressTickResolved";
      payload: FearStressTickResolvedPayload;
    })
  | (EventMeta & { type: "BurningApplied"; payload: BurningAppliedPayload })
  | (EventMeta & { type: "BurningRemoved"; payload: BurningRemovedPayload })
  | (EventMeta & {
      type: "BurningTickResolved";
      payload: BurningTickResolvedPayload;
    });

export type EngineEventType = EngineEvent["type"];

/** An event before it has been assigned its sequence number by the store. */
export type DraftEvent = Omit<EngineEvent, "sequence">;
