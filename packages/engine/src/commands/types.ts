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
  | OpportunityAttackCommand
  | ReadyActionCommand
  | TriggerReadiedCommand
  | CastSpellCommand;

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
  | "INVALID_TARGET"
  | "UNKNOWN_CONDITION"
  | "NOT_DYING"
  | "ALREADY_DEAD"
  | "NO_REACTION"
  | "NOT_PROVOKED"
  | "NO_READIED_ACTION"
  | "SPELL_NOT_FOUND"
  | "SPELL_NOT_PREPARED"
  | "NOT_A_SPELLCASTER"
  | "NO_SPELL_SLOT"
  | "OUT_OF_RANGE";

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
