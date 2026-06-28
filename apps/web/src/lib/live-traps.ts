import type { GridPosition, SceneTrapInstance } from "@app/engine";
import { getTrapDefinition } from "@app/engine";

/** Chebyshev distance in grid cells (matches movement adjacency). */
export function chebyshevCells(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Traps the actor can interact with (same cell or adjacent). */
export function trapsInRange(
  traps: readonly SceneTrapInstance[] | undefined,
  position: GridPosition | undefined,
  maxCells = 1,
): SceneTrapInstance[] {
  if (!traps?.length || !position) return [];
  return traps.filter(
    (t) => !t.disabled && chebyshevCells(t.position, position) <= maxCells,
  );
}

export function trapLabel(
  trap: SceneTrapInstance,
  detected: boolean,
): string {
  if (!detected) return "Hidden trap";
  const def = getTrapDefinition(trap.trapSlug);
  return def?.name ?? trap.trapSlug;
}
