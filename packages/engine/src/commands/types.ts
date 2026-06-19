/**
 * Command API types (E1 subset).
 *
 * The same typed Command set drives both LLM tool calls and UI player actions —
 * equal validation, equal events (`docs/engine/architecture.md` §4). A Command
 * produces zero events (rejected) or N events (accepted). This file is the
 * contract; validation lives in `./validators`, execution in `./handlers`.
 */
import type {
  EntityInit,
  EntityRef,
  GridPosition,
  SceneId,
  SceneState,
} from "../entities/types";
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

export type Command =
  | CreateSceneCommand
  | ChangeSceneCommand
  | CreateEntityCommand
  | RollDiceCommand
  | ApplyDamageCommand
  | ApplyHealingCommand
  | MoveEntityCommand;

export type CommandType = Command["type"];

export type ValidationCode =
  | "ACTOR_NOT_FOUND"
  | "TARGET_NOT_FOUND"
  | "TARGET_DEAD"
  | "SCENE_NOT_FOUND"
  | "DUPLICATE_ENTITY"
  | "DUPLICATE_SCENE"
  | "INVALID_PAYLOAD";

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
