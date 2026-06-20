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

/** Open an encounter over a set of combatants in a scene. Initiative is rolled separately. */
export type StartEncounterCommand = {
  type: "start_encounter";
  /** Defaults to the current scene. */
  sceneId?: SceneId;
  combatants: EntityRef[];
};

/** Roll initiative for every combatant in the open encounter and begin round 1. */
export type RollInitiativeCommand = {
  type: "roll_initiative";
  /** Flat per-combatant initiative bonuses (e.g. Alert feat). */
  bonuses?: Record<EntityRef, number>;
};

/** End the active combatant's turn, advancing the order (and round on wrap). */
export type EndTurnCommand = {
  type: "end_turn";
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

export type Command =
  | CreateSceneCommand
  | ChangeSceneCommand
  | CreateEntityCommand
  | RollDiceCommand
  | ApplyDamageCommand
  | ApplyHealingCommand
  | MoveEntityCommand
  | StartEncounterCommand
  | RollInitiativeCommand
  | EndTurnCommand
  | AttackCommand
  | ApplyConditionCommand
  | RemoveConditionCommand
  | SavingThrowCommand;

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
  | "OUT_OF_BOUNDS"
  | "CELL_BLOCKED"
  | "CELL_OCCUPIED"
  | "INSUFFICIENT_MOVEMENT"
  | "NO_LINE_OF_SIGHT"
  | "ACTION_UNAVAILABLE"
  | "IMMOBILIZED"
  | "INVALID_TARGET"
  | "UNKNOWN_CONDITION";

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
