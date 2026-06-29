/**
 * Cover between two positioned combatants on a square grid (SRD 5.2.1 tracer).
 *
 * Uses the Bresenham line between attacker and target. Cells strictly between
 * the endpoints that `providesCover` marks as blocking grant:
 * - 1 blocker → half cover (+2 AC / Dex saves)
 * - 2+ blockers → three-quarters cover (+5)
 *
 * Total cover (no line of sight) is handled separately by {@link hasLineOfSight}.
 */
import type { GridPosition } from "../entities/types";
import { lineCells } from "./grid";

export type CoverTier = "none" | "half" | "three_quarters";

/** AC or Dex-save bonus from cover tier. */
export function coverBonus(tier: CoverTier): number {
  if (tier === "half") return 2;
  if (tier === "three_quarters") return 5;
  return 0;
}

/**
 * Cover tier from `from` (attacker or effect origin) to `to` (target).
 * Endpoints never count as cover sources.
 */
export function coverBetween(
  from: GridPosition,
  to: GridPosition,
  providesCover: (cell: GridPosition) => boolean,
): CoverTier {
  const cells = lineCells(from, to);
  if (cells.length <= 2) return "none";
  let blockers = 0;
  for (let i = 1; i < cells.length - 1; i += 1) {
    if (providesCover(cells[i]!)) blockers += 1;
  }
  if (blockers <= 0) return "none";
  if (blockers === 1) return "half";
  return "three_quarters";
}

/** Convenience wrapper returning the numeric AC/save bonus. */
export function coverAcBonusFromLine(
  from: GridPosition,
  to: GridPosition,
  providesCover: (cell: GridPosition) => boolean,
): number {
  return coverBonus(coverBetween(from, to, providesCover));
}
