/**
 * Pure combat helpers — initiative ordering and action-economy resets.
 *
 * No state, no randomness: these are deterministic transforms over already-rolled
 * values, safe to call from handlers and to unit-test in isolation. The seeded
 * d20 rolls themselves are drawn in the handler via `ctx.roll`; the tiebreak roll
 * is likewise drawn upstream and passed in here (arch §5.4).
 */
import type { ActionEconomyState, EntityRef } from "../entities/types";

/** A combatant's resolved initiative, used to drive turn order. */
export type InitiativeEntry = { entity: EntityRef; initiative: number };

/** Raw inputs to the initiative sort, before tie resolution. */
export type InitiativeRollInput = {
  entity: EntityRef;
  /** d20 + DEX mod + bonuses. */
  initiative: number;
  /** DEX ability score — first tiebreak (SRD). */
  dexScore: number;
  /** Seeded d20 tiebreak — second tiebreak ("then random"). */
  tiebreak: number;
};

/**
 * Sort combatants into descending turn order: initiative, then DEX score, then a
 * seeded random roll, then a stable id fallback so the result is fully
 * deterministic for a given seed (arch §5.4).
 */
export function sortInitiative(
  entries: readonly InitiativeRollInput[],
): InitiativeEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.initiative - a.initiative ||
        b.dexScore - a.dexScore ||
        b.tiebreak - a.tiebreak ||
        (a.entity < b.entity ? -1 : a.entity > b.entity ? 1 : 0),
    )
    .map((e) => ({ entity: e.entity, initiative: e.initiative }));
}

/** A fresh, fully-available action economy for the start of a combatant's turn. */
export function freshActionEconomy(speed: number): ActionEconomyState {
  return {
    action: "available",
    bonusAction: "available",
    reaction: "available",
    movement: { used: 0, total: Math.max(0, speed) },
    freeInteractionUsed: false,
  };
}
