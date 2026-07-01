/**
 * DUN-12 — bridge authored floor traps into Live Play scene instances.
 */
import type { SceneTrapInstance } from "../entities/types";
import type { NormalizedDungeonFloor, NormalizedDungeonTrap } from "./types";

function trapPosition(
  trap: NormalizedDungeonTrap,
  floor: NormalizedDungeonFloor,
): { x: number; y: number } | undefined {
  if (trap.scope === "cell" && trap.cell) return trap.cell;
  if (trap.scope === "connection" && trap.connectionId) {
    for (const zone of floor.zones) {
      const conn = zone.connections.find((c) => c.connectionId === trap.connectionId);
      if (conn?.fromCells[0]) return conn.fromCells[0];
    }
  }
  return undefined;
}

/** Cell + connection traps become scene instances; zone-wide traps are prep-only until DUN-13+. */
export function sceneTrapsFromFloor(
  floor: NormalizedDungeonFloor,
): SceneTrapInstance[] {
  const traps: SceneTrapInstance[] = [];
  for (const zone of floor.zones) {
    for (const trap of zone.traps) {
      if (trap.scope === "zone") continue;
      const position = trapPosition(trap, floor);
      if (!position) continue;
      traps.push({
        instanceId: trap.trapId,
        trapSlug: trap.codexSlug,
        position,
        detected: false,
        disabled: false,
        triggered: false,
      });
    }
  }
  return traps;
}
