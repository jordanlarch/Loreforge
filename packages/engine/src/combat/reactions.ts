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

/** Parse `in_range:<ft>` from a readied-action trigger string. */
export function readyTriggerRangeFeet(trigger: string): number {
  const match = /^in_range:(\d{1,3})$/.exec(trigger);
  return match ? Number.parseInt(match[1]!, 10) : REACH_FEET;
}

/**
 * Two combatants are hostile when both belong to a side and the sides differ
 * (team-id model: party vs goblins, or goblins vs cult in a three-way fight).
 *
 * A combatant with no assigned side is **neutral**: it neither provokes nor is
 * provoked, so most monsters/NPCs need no faction until the GM/AI assigns one.
 * This is intentionally distinct from Realms "Factions" (a narrative entity
 * type) — sides are a per-encounter combat primitive that Factions may later
 * seed, not the same thing.
 */
export function areHostile(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && a !== b;
}

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

/** The reach (in feet) a reactor threatens for opportunity attacks. */
export function opportunityAttackReach(reactor: { meleeReachFt?: number }): number {
  return reactor.meleeReachFt ?? REACH_FEET;
}
