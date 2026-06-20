/**
 * Pure helpers for the reaction layer (architecture.md §5.3).
 *
 * The full interrupt-driven reaction system (windows, prompts, Counterspell &c.)
 * is a later product-track concern. This slice covers the deterministic engine
 * primitives: detecting an opportunity-attack provoke and the reach constant.
 */
import type { GridPosition } from "../entities/types";
import { distanceFeet } from "./grid";

/** Default melee reach in feet. */
export const REACH_FEET = 5 as const;

/**
 * Does moving `from` → `to` provoke an opportunity attack from a creature at
 * `threatener`? SRD: leaving a hostile's reach provokes — i.e. you start within
 * its reach and end outside it. Moving *within* reach (or never in reach) does
 * not provoke.
 */
export function provokesOpportunityAttack(
  threatener: GridPosition,
  from: GridPosition,
  to: GridPosition,
  reach: number = REACH_FEET,
): boolean {
  return (
    distanceFeet(threatener, from) <= reach && distanceFeet(threatener, to) > reach
  );
}
