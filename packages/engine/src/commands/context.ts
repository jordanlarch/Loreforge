/**
 * Execution context passed to command handlers.
 *
 * Gives a handler everything it needs to validate and resolve a command purely:
 * the current projected world state and a deterministic roll function. The
 * handler returns draft events; it never touches the store or RNG counters
 * directly (the engine owns those).
 */
import type { RollMode } from "../rng/dice";
import type { WorldState } from "../projections/world-state";

export type RollOutcome = {
  notation: string;
  rolls: number[];
  total: number;
  scope: string;
  drawIndex: number;
};

export type RollFn = (
  notation: string,
  scope: string,
  mode?: RollMode,
) => RollOutcome;

export type ExecutionContext = {
  campaignId: string;
  commandId: string;
  timestamp: number;
  actor?: string;
  world: WorldState;
  roll: RollFn;
};
