/**
 * Pure square-grid geometry — distance and line of sight.
 *
 * **Distance convention: SRD 5-5-5 (Chebyshev).** Every step counts as 5 ft,
 * whether orthogonal or diagonal, so the distance in cells between two squares
 * is `max(|dx|, |dy|)` and the distance in feet is that times 5. (The DMG
 * variant 5-10-5 — alternating diagonal cost — is deliberately not used.)
 *
 * No state, no randomness: callers supply a `isBlocked` predicate so this module
 * stays decoupled from the world projection.
 */
import type { GridPosition } from "../entities/types";

/** Feet per grid cell under the 5-5-5 convention. */
export const FEET_PER_CELL = 5 as const;

/** Chebyshev distance in cells: `max(|dx|, |dy|)`. */
export function chebyshev(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Distance in feet between two cells (5-5-5). */
export function distanceFeet(a: GridPosition, b: GridPosition): number {
  return chebyshev(a, b) * FEET_PER_CELL;
}

/**
 * Cells touched by the straight line from `a` to `b` (inclusive of both
 * endpoints), via integer Bresenham.
 */
export function lineCells(a: GridPosition, b: GridPosition): GridPosition[] {
  const points: GridPosition[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    points.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/**
 * Whether `a` can see `b`: true unless a cell strictly between them (endpoints
 * excluded) is blocked. Walls and occupied cells both block — the caller decides
 * which via `isBlocked`.
 */
export function hasLineOfSight(
  a: GridPosition,
  b: GridPosition,
  isBlocked: (cell: GridPosition) => boolean,
): boolean {
  const cells = lineCells(a, b);
  for (let i = 1; i < cells.length - 1; i += 1) {
    if (isBlocked(cells[i]!)) return false;
  }
  return true;
}
