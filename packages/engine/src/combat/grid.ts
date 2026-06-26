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

/**
 * Cosine of a 5E cone's half-angle. A cone's width at distance `d` equals `d`,
 * so the half-angle θ satisfies `tan θ = (d/2)/d = 1/2`, giving
 * `cos θ = 2/√5 ≈ 0.894`. A cell is inside the cone when the angle between the
 * aim direction and the cell direction is ≤ θ.
 */
export const CONE_HALF_ANGLE_COS = 2 / Math.sqrt(5);

/**
 * Whether `cell` falls within a burst/sphere of `radiusFeet` centered on
 * `center` (5-5-5 Chebyshev). The center cell itself is included.
 */
export function withinBurst(
  center: GridPosition,
  cell: GridPosition,
  radiusFeet: number,
): boolean {
  return distanceFeet(center, cell) <= radiusFeet;
}

/**
 * Whether `cell` falls within a `lengthFeet` cone emanating from `apex` aimed
 * toward `toward`. The apex cell is never affected (a self-cone does not catch
 * the caster); cells beyond the length or outside the half-angle are excluded.
 * Returns false when no aim direction is given (`toward === apex`).
 */
export function withinCone(
  apex: GridPosition,
  toward: GridPosition,
  cell: GridPosition,
  lengthFeet: number,
): boolean {
  const vx = cell.x - apex.x;
  const vy = cell.y - apex.y;
  if (vx === 0 && vy === 0) return false;
  const dist = distanceFeet(apex, cell);
  if (dist <= 0 || dist > lengthFeet) return false;
  const dx = toward.x - apex.x;
  const dy = toward.y - apex.y;
  if (dx === 0 && dy === 0) return false;
  const dot = vx * dx + vy * dy;
  if (dot <= 0) return false;
  const cos = dot / (Math.hypot(vx, vy) * Math.hypot(dx, dy));
  return cos >= CONE_HALF_ANGLE_COS - 1e-9;
}

/** Furthest grid cell reachable along the 8-way direction from `from` through `toward`. */
export function lineEndpoint(
  from: GridPosition,
  toward: GridPosition,
  lengthFeet: number,
): GridPosition {
  const maxCells = Math.max(1, Math.floor(lengthFeet / FEET_PER_CELL));
  const dx = Math.sign(toward.x - from.x);
  const dy = Math.sign(toward.y - from.y);
  if (dx === 0 && dy === 0) return from;
  return { x: from.x + dx * maxCells, y: from.y + dy * maxCells };
}

/**
 * Whether `cell` lies on a line of `lengthFeet` (5 ft wide) from `from` aimed
 * toward `toward`. The line includes the caster's square only when it is also
 * on the path toward the aim (Lightning Bolt emanates from the caster).
 */
export function withinLine(
  from: GridPosition,
  toward: GridPosition,
  cell: GridPosition,
  lengthFeet: number,
  widthFeet = FEET_PER_CELL,
): boolean {
  if (from.x === toward.x && from.y === toward.y) return false;
  const end = lineEndpoint(from, toward, lengthFeet);
  const path = lineCells(from, end);
  const halfWidth = Math.max(0, Math.floor(widthFeet / FEET_PER_CELL) - 1);
  for (const p of path) {
    if (p.x === cell.x && p.y === cell.y) return true;
    if (halfWidth > 0) {
      for (let ox = -halfWidth; ox <= halfWidth; ox += 1) {
        for (let oy = -halfWidth; oy <= halfWidth; oy += 1) {
          if (p.x + ox === cell.x && p.y + oy === cell.y) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Whether `cell` falls inside an axis-aligned cube of `edgeFeet` centered on
 * `center` (Chebyshev half-edge tracer for the square grid).
 */
export function withinCube(
  center: GridPosition,
  cell: GridPosition,
  edgeFeet: number,
): boolean {
  const half = edgeFeet / 2;
  return distanceFeet(center, cell) <= half;
}
