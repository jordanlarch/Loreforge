import type { EntityRef } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { FIXTURE_BATTLE_PARTY_SIDE } from "../fixtures/battle";
import { areHostile } from "./reactions";

/** True when every hostile combatant in the encounter is down. */
export function allHostileCombatantsDefeated(
  state: WorldState,
  friendlySide: string = FIXTURE_BATTLE_PARTY_SIDE,
): boolean {
  const enc = state.encounter;
  if (!enc) return false;

  let hadHostile = false;
  for (const id of enc.combatants) {
    const entity = state.entities[id];
    if (!entity) continue;
    const side = enc.sides[id];
    const hostile =
      side !== undefined
        ? areHostile(friendlySide, side)
        : entity.kind === "monster" || entity.kind === "npc";
    if (!hostile) continue;
    hadHostile = true;
    if (entity.alive) return false;
  }
  return hadHostile;
}

/** Party-side ids still standing in the encounter. */
export function friendlyCombatantsAlive(
  state: WorldState,
  friendlySide: string = FIXTURE_BATTLE_PARTY_SIDE,
): EntityRef[] {
  const enc = state.encounter;
  if (!enc) return [];
  return enc.combatants.filter((id: EntityRef) => {
    const entity = state.entities[id];
    if (!entity?.alive) return false;
    const side = enc.sides[id];
    if (side !== undefined) return !areHostile(friendlySide, side);
    return entity.kind === "character";
  });
}
