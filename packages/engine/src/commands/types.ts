/**
 * Command API types (E1 subset).
 *
 * The same typed Command set drives both LLM tool calls and UI player actions —
 * equal validation, equal events (`docs/engine/architecture.md` §4). A Command
 * produces zero events (rejected) or N events (accepted). This file is the
 * contract; validation lives in `./validators`, execution in `./handlers`.
 */
import type {
  Ability,
  EntityInit,
  EntityRef,
  GridPosition,
  ReadiedAction,
  SceneId,
  SceneState,
} from "../entities/types";
import type { Condition } from "../combat/conditions";
import type { RollMode } from "../rng/dice";
import type { DraftEvent } from "../events/types";

export type CreateSceneCommand = {
  type: "create_scene";
  scene: SceneState;
};

export type ChangeSceneCommand = {
  type: "change_scene";
  sceneId: SceneId;
};

export type CreateEntityCommand = {
  type: "create_entity";
  entity: EntityInit;
};

export type RollDiceCommand = {
  type: "roll_dice";
  notation: string;
  mode?: RollMode;
  /** RNG scope; defaults to "default". */
  scope?: string;
};

/** Amount may be fixed or rolled from dice notation. */
export type DamageSource =
  | { amount: number }
  | { notation: string };

export type ApplyDamageCommand = {
  type: "apply_damage";
  target: EntityRef;
  damageType: string;
  source: DamageSource;
  scope?: string;
};

export type ApplyHealingCommand = {
  type: "apply_healing";
  target: EntityRef;
  source: DamageSource;
  scope?: string;
};

export type MoveEntityCommand = {
  type: "move_entity";
  entity: EntityRef;
  to: GridPosition;
};

/**
 * Move an existing entity to another scene (and optional cell) — an exploration
 * scene transition, distinct from in-scene `move_entity` (which is budgeted and
 * occupancy-checked within one map). Used to carry the party between scenes.
 */
export type RelocateEntityCommand = {
  type: "relocate_entity";
  entity: EntityRef;
  sceneId: SceneId;
  position?: GridPosition;
};

/** Open an encounter over a set of combatants in a scene. Initiative is rolled separately. */
export type StartEncounterCommand = {
  type: "start_encounter";
  /** Defaults to the current scene. */
  sceneId?: SceneId;
  combatants: EntityRef[];
  /**
   * Optional per-combatant side/team id (team-id model). Combatants on different
   * sides are hostile (drive opportunity-attack eligibility); an omitted entry is
   * neutral. Keys must be a subset of `combatants`. Distinct from Realms Factions.
   */
  sides?: Record<EntityRef, string>;
};

/** Roll initiative for every combatant in the open encounter and begin round 1. */
export type RollInitiativeCommand = {
  type: "roll_initiative";
  /** Flat per-combatant initiative bonuses (e.g. Alert feat). */
  bonuses?: Record<EntityRef, number>;
};

/** Add a living entity to an in-progress encounter after initiative (#98). */
export type AddCombatantCommand = {
  type: "add_combatant";
  entityId: EntityRef;
  side: string;
};

/** End the active combatant's turn, advancing the order (and round on wrap). */
export type EndTurnCommand = {
  type: "end_turn";
};

/** Tear down the open encounter and return to exploration mode. */
export type EndEncounterCommand = {
  type: "end_encounter";
};

/**
 * Resolve a weapon attack: d20 + `attackBonus` vs the target's AC (with optional
 * advantage/disadvantage), then roll and apply damage on a hit (doubled dice on
 * a crit). Attack bonus and damage are supplied by the caller — weapon/feature
 * derivation arrives with the inventory/effect systems.
 */
export type AttackCommand = {
  type: "attack";
  attacker: EntityRef;
  target: EntityRef;
  attackBonus: number;
  damage: { notation: string; type: string };
  /** Effective reach/range in feet; defaults to melee (5 ft) on a mapped scene. */
  rangeFt?: number;
  mode?: RollMode;
};

/** Apply an SRD condition to a target (exhaustion carries a 1-6 level). */
export type ApplyConditionCommand = {
  type: "apply_condition";
  target: EntityRef;
  condition: Condition;
  source?: EntityRef;
  /** Exhaustion tier 1-6; ignored for other conditions. */
  level?: number;
};

export type RemoveConditionCommand = {
  type: "remove_condition";
  target: EntityRef;
  condition: Condition;
};

/**
 * Resolve a saving throw: d20 + ability modifier vs DC, honouring condition
 * auto-fails (STR/DEX while paralyzed etc.) and advantage/disadvantage.
 */
export type SavingThrowCommand = {
  type: "saving_throw";
  entity: EntityRef;
  ability: Ability;
  dc: number;
  mode?: RollMode;
  /** Origin for cover on Dex saves (defaults to no cover bonus). */
  coverOrigin?: GridPosition;
  ignoreCover?: boolean;
  /** When set, overrides entity save proficiency lookup. */
  proficient?: boolean;
};

/**
 * Resolve an ability/skill check: d20 + ability modifier, plus the entity's
 * proficiency bonus when `proficient`. With a `dc` it yields pass/fail; without,
 * it is an uncontested roll the GM interprets. `skill` is display-only (the SRD
 * skill→ability mapping is the caller's; here the ability is authoritative).
 */
export type AbilityCheckCommand = {
  type: "ability_check";
  entity: EntityRef;
  ability: Ability;
  skill?: string;
  dc?: number;
  proficient?: boolean;
  mode?: RollMode;
};

/** Roll a death saving throw for a creature dying at 0 HP. */
export type DeathSaveCommand = {
  type: "death_save";
  entity: EntityRef;
  mode?: RollMode;
};

/**
 * Short rest: optionally spend Hit Dice to heal. The die size is supplied by the
 * caller (the engine does not yet track a hit-dice pool); each die adds CON mod.
 */
export type ShortRestCommand = {
  type: "short_rest";
  entity: EntityRef;
  hitDice?: number;
  dieSize?: number;
};

/** Long rest: restore HP to full, clear dying state, reduce exhaustion by one. */
export type LongRestCommand = {
  type: "long_rest";
  entity: EntityRef;
};

export type StartConcentrationCommand = {
  type: "start_concentration";
  entity: EntityRef;
  spell: string;
};

export type EndConcentrationCommand = {
  type: "end_concentration";
  entity: EntityRef;
};

/** Dispel Magic — end one spell effect or concentration-linked condition on a target. */
export type DispelMagicCommand = {
  type: "dispel_magic";
  caster: EntityRef;
  target: EntityRef;
  slotLevel: number;
};

/**
 * An opportunity attack: a reaction-cost attack against a creature that left the
 * reactor's reach. Valid only against the mover of an open reaction window.
 */
export type OpportunityAttackCommand = {
  type: "opportunity_attack";
  reactor: EntityRef;
  target: EntityRef;
  attackBonus: number;
  damage: { notation: string; type: string };
  /** Weapon reach for the OA strike; defaults to melee (5 ft). */
  rangeFt?: number;
  mode?: RollMode;
};
export type ReadyActionCommand = {
  type: "ready_action";
  entity: EntityRef;
  trigger: string;
  action: ReadiedAction;
};

/** Resolve a previously-readied action when its trigger fires (costs a reaction). */
export type TriggerReadiedCommand = {
  type: "trigger_readied";
  entity: EntityRef;
};

/**
 * Cast a spell from the in-engine registry (#40). The engine derives the save
 * DC / spell attack from the caster's spellcasting ability, consumes a slot
 * (cantrips consume none), validates range + line of sight, and resolves the
 * spell's declarative effect. `slotLevel` is the slot spent (≥ the spell's base
 * level; 0 for cantrips). `targets` lists the affected creatures — for a
 * projectile spell (Magic Missile) it lists one entry per dart. For an area
 * spell (Fireball, Burning Hands) `origin` is the burst point / aim cell and
 * `targets` is ignored — the engine resolves caught creatures from the area
 * shape. `origin` is unused by single/multi-target spells.
 */
export type CastSpellCommand = {
  type: "cast_spell";
  caster: EntityRef;
  spellId: string;
  slotLevel: number;
  targets?: EntityRef[];
  origin?: GridPosition;
  mode?: RollMode;
};

export type DetectTrapCommand = {
  type: "detect_trap";
  entity: EntityRef;
  sceneId: SceneId;
  trapInstanceId: string;
};

export type DisableTrapCommand = {
  type: "disable_trap";
  entity: EntityRef;
  sceneId: SceneId;
  trapInstanceId: string;
};

export type TriggerTrapCommand = {
  type: "trigger_trap";
  sceneId: SceneId;
  trapInstanceId: string;
  victim: EntityRef;
};

export type CoatWeaponCommand = {
  type: "coat_weapon";
  entity: EntityRef;
  poisonSlug: string;
};

export type ApplyPoisonCommand = {
  type: "apply_poison";
  target: EntityRef;
  poisonSlug: string;
  /** Injury delivery — clear coat on attacker after one hit. */
  source?: EntityRef;
};

export type ResolvePoisonTickCommand = {
  type: "resolve_poison_tick";
  entity: EntityRef;
  instanceId: string;
};

export type ApplyCurseCommand = {
  type: "apply_curse";
  target: EntityRef;
  curseSlug: string;
};

export type ResolveCurseTickCommand = {
  type: "resolve_curse_tick";
  entity: EntityRef;
  instanceId: string;
};

export type RemoveCurseCommand = {
  type: "remove_curse";
  target: EntityRef;
  instanceId: string;
};

export type SetSceneEnvironmentalEffectsCommand = {
  type: "set_scene_environmental_effects";
  sceneId: SceneId;
  slugs: string[];
};

export type ApplyEnvironmentalEffectCommand = {
  type: "apply_environmental_effect";
  target: EntityRef;
  effectSlug: string;
};

export type ResolveEnvironmentalEffectTickCommand = {
  type: "resolve_environmental_effect_tick";
  entity: EntityRef;
  instanceId: string;
};

export type RemoveEnvironmentalEffectCommand = {
  type: "remove_environmental_effect";
  target: EntityRef;
  instanceId: string;
};

export type ApplyFearStressCommand = {
  type: "apply_fear_stress";
  target: EntityRef;
  fearStressSlug: string;
  /** When set, instance clears on leave from this scene (Q4 C1). */
  boundSceneId?: SceneId;
};

export type ResolveFearStressTickCommand = {
  type: "resolve_fear_stress_tick";
  entity: EntityRef;
  instanceId: string;
};

export type RemoveFearStressCommand = {
  type: "remove_fear_stress";
  target: EntityRef;
  instanceId: string;
};

export type ApplyFallDamageCommand = {
  type: "apply_fall_damage";
  target: EntityRef;
  heightFt: number;
};

export type ApplyBurningCommand = {
  type: "apply_burning";
  target: EntityRef;
  burningSlug?: string;
};

export type ExtinguishBurningCommand = {
  type: "extinguish_burning";
  target: EntityRef;
  instanceId: string;
  method: "action" | "dex_save";
};

export type ResolveBurningTickCommand = {
  type: "resolve_burning_tick";
  entity: EntityRef;
  instanceId: string;
};

/** Spend your action to gain extra movement equal to your Speed (SRD Dash). */
export type DashCommand = { type: "dash"; entity: EntityRef };

/** Spend your action; your movement doesn't provoke opportunity attacks this turn. */
export type DisengageCommand = { type: "disengage"; entity: EntityRef };

/**
 * Spend your action; until your next turn starts, attacks against you have
 * disadvantage and you have advantage on Dexterity saving throws.
 */
export type DodgeCommand = { type: "dodge"; entity: EntityRef };

/** Grant an ally advantage on a check or on an attack against a nearby foe. */
export type HelpCommand = {
  type: "help";
  helper: EntityRef;
  beneficiary: EntityRef;
  mode: "attack" | "check";
  /** Required when `mode` is `attack`. */
  foe?: EntityRef;
};

/** Hide — Dexterity (Stealth) check; on success gain the Invisible condition. */
export type HideCommand = {
  type: "hide";
  entity: EntityRef;
  /** Defaults to 15 (SRD Hide action tracer). */
  dc?: number;
  proficient?: boolean;
  mode?: RollMode;
};

export type Command =
  | CreateSceneCommand
  | ChangeSceneCommand
  | CreateEntityCommand
  | RollDiceCommand
  | ApplyDamageCommand
  | ApplyHealingCommand
  | MoveEntityCommand
  | RelocateEntityCommand
  | StartEncounterCommand
  | EndEncounterCommand
  | RollInitiativeCommand
  | AddCombatantCommand
  | EndTurnCommand
  | AttackCommand
  | ApplyConditionCommand
  | RemoveConditionCommand
  | SavingThrowCommand
  | AbilityCheckCommand
  | DeathSaveCommand
  | ShortRestCommand
  | LongRestCommand
  | StartConcentrationCommand
  | EndConcentrationCommand
  | DispelMagicCommand
  | OpportunityAttackCommand
  | ReadyActionCommand
  | TriggerReadiedCommand
  | CastSpellCommand
  | DetectTrapCommand
  | DisableTrapCommand
  | TriggerTrapCommand
  | CoatWeaponCommand
  | ApplyPoisonCommand
  | ResolvePoisonTickCommand
  | ApplyCurseCommand
  | ResolveCurseTickCommand
  | RemoveCurseCommand
  | SetSceneEnvironmentalEffectsCommand
  | ApplyEnvironmentalEffectCommand
  | ResolveEnvironmentalEffectTickCommand
  | RemoveEnvironmentalEffectCommand
  | ApplyFearStressCommand
  | ResolveFearStressTickCommand
  | RemoveFearStressCommand
  | ApplyFallDamageCommand
  | ApplyBurningCommand
  | ExtinguishBurningCommand
  | ResolveBurningTickCommand
  | DashCommand
  | DisengageCommand
  | DodgeCommand
  | HelpCommand
  | HideCommand;

export type CommandType = Command["type"];

export type ValidationCode =
  | "ACTOR_NOT_FOUND"
  | "TARGET_NOT_FOUND"
  | "TARGET_DEAD"
  | "SCENE_NOT_FOUND"
  | "DUPLICATE_ENTITY"
  | "DUPLICATE_SCENE"
  | "INVALID_PAYLOAD"
  | "ENCOUNTER_EXISTS"
  | "NO_ENCOUNTER"
  | "EMPTY_ENCOUNTER"
  | "NOT_IN_ENCOUNTER"
  | "INITIATIVE_NOT_ROLLED"
  | "INITIATIVE_ALREADY_ROLLED"
  | "COMBATANT_ALREADY_PRESENT"
  | "OUT_OF_BOUNDS"
  | "CELL_BLOCKED"
  | "CELL_OCCUPIED"
  | "INSUFFICIENT_MOVEMENT"
  | "NO_LINE_OF_SIGHT"
  | "ACTION_UNAVAILABLE"
  | "IMMOBILIZED"
  | "FRIGHTENED"
  | "INVALID_TARGET"
  | "UNKNOWN_CONDITION"
  | "NOT_DYING"
  | "ALREADY_DEAD"
  | "NO_REACTION"
  | "NOT_PROVOKED"
  | "NO_READIED_ACTION"
  | "SPELL_NOT_FOUND"
  | "SPELL_NOT_PREPARED"
  | "TRAP_NOT_FOUND"
  | "TRAP_ALREADY_DISABLED"
  | "TRAP_NOT_DETECTED"
  | "TRAP_NO_DETECT"
  | "TRAP_NO_DISABLE"
  | "TRAP_ALREADY_TRIGGERED"
  | "POISON_NOT_FOUND"
  | "POISON_WRONG_TYPE"
  | "POISON_NOT_ACTIVE"
  | "POISON_DELIVERY_NOT_SUPPORTED"
  | "CURSE_NOT_FOUND"
  | "CURSE_NOT_ACTIVE"
  | "CURSE_ALREADY_ACTIVE"
  | "CURSE_DELIVERY_NOT_SUPPORTED"
  | "ENVIRONMENTAL_EFFECT_NOT_FOUND"
  | "ENVIRONMENTAL_EFFECT_ALREADY_ACTIVE"
  | "ENVIRONMENTAL_EFFECT_NOT_ACTIVE"
  | "FEAR_STRESS_NOT_FOUND"
  | "FEAR_STRESS_ALREADY_ACTIVE"
  | "FEAR_STRESS_NOT_ACTIVE"
  | "FEAR_STRESS_DELIVERY_NOT_SUPPORTED"
  | "BURNING_NOT_FOUND"
  | "BURNING_ALREADY_ACTIVE"
  | "BURNING_NOT_ACTIVE"
  | "NOT_A_SPELLCASTER"
  | "NO_SPELL_SLOT"
  | "NO_MAGIC_TO_DISPEL"
  | "OUT_OF_RANGE"
  | "NOT_ADJACENT";

export type ValidationFailure = {
  code: ValidationCode;
  message: string;
  detail?: Record<string, unknown>;
};

export type CommandSummary = Record<string, unknown>;

export type CommandResult =
  | { accepted: true; events: DraftEvent[]; summary: CommandSummary }
  | { accepted: false; reason: ValidationFailure };

export function reject(
  code: ValidationCode,
  message: string,
  detail?: Record<string, unknown>,
): CommandResult {
  return { accepted: false, reason: { code, message, detail } };
}
