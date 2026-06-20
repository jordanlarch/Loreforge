/**
 * Pure square-grid geometry for the battle map.
 *
 * No PixiJS, React, or engine imports — just cell↔pixel conversions and
 * reachability, so it is unit-testable in isolation. The engine remains the
 * authority on whether a move is *legal* (it re-validates every `move_entity`);
 * `reachableCells` here only drives the movement-radius highlight the player
 * sees, using the SRD 5-5-5 convention (every king-step costs 5 ft).
 */
export type Cell = { x: number; y: number };

/** Top-left pixel of a cell. */
export function cellToPixel(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: cell.x * cellSize, y: cell.y * cellSize };
}

/** Center pixel of a cell (where a token is drawn). */
export function cellCenter(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: (cell.x + 0.5) * cellSize, y: (cell.y + 0.5) * cellSize };
}

/** The cell containing a pixel coordinate (floored). */
export function pixelToCell(px: number, py: number, cellSize: number): Cell {
  return { x: Math.floor(px / cellSize), y: Math.floor(py / cellSize) };
}

/** Clamp a cell into `[0, cols) × [0, rows)`. */
export function clampCell(cell: Cell, cols: number, rows: number): Cell {
  return {
    x: Math.max(0, Math.min(cols - 1, cell.x)),
    y: Math.max(0, Math.min(rows - 1, cell.y)),
  };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Chebyshev distance in cells (5-5-5: diagonal costs the same as orthogonal). */
export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

/**
 * Cells reachable from `origin` within `maxSteps` king-moves, flood-filling
 * around blocked cells (8-directional BFS). The origin itself is excluded.
 * `blocked` marks walls (impassable); `inBounds` rejects off-grid cells.
 */
export function reachableCells(
  origin: Cell,
  maxSteps: number,
  inBounds: (cell: Cell) => boolean,
  blocked: (cell: Cell) => boolean,
): Cell[] {
  const result: Cell[] = [];
  if (maxSteps <= 0) return result;

  const visited = new Set<string>([cellKey(origin)]);
  let frontier: Cell[] = [origin];

  for (let step = 0; step < maxSteps; step += 1) {
    const next: Cell[] = [];
    for (const cell of frontier) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = { x: cell.x + dx, y: cell.y + dy };
          const key = cellKey(neighbor);
          if (visited.has(key)) continue;
          if (!inBounds(neighbor) || blocked(neighbor)) {
            visited.add(key);
            continue;
          }
          visited.add(key);
          result.push(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return result;
}
