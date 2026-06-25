import { describe, expect, it } from "vitest";

import {
  cellCenter,
  cellToPixel,
  chebyshev,
  clampCell,
  mapCanvasPixelSize,
  pixelToCell,
  reachableCells,
  sameCell,
  type Cell,
} from "./geometry";

describe("cell <-> pixel", () => {
  it("derives canvas size from grid dimensions", () => {
    expect(mapCanvasPixelSize(12, 10)).toEqual({ width: 528, height: 440 });
  });

  it("maps a cell to its top-left and center", () => {
    expect(cellToPixel({ x: 2, y: 3 }, 40)).toEqual({ x: 80, y: 120 });
    expect(cellCenter({ x: 2, y: 3 }, 40)).toEqual({ x: 100, y: 140 });
  });

  it("rounds a pixel back to its containing cell", () => {
    expect(pixelToCell(99, 141, 40)).toEqual({ x: 2, y: 3 });
    expect(pixelToCell(80, 120, 40)).toEqual({ x: 2, y: 3 });
  });

  it("is a round-trip for cell centers", () => {
    const cell = { x: 5, y: 7 };
    const center = cellCenter(cell, 32);
    expect(pixelToCell(center.x, center.y, 32)).toEqual(cell);
  });
});

describe("clampCell", () => {
  it("clamps into bounds", () => {
    expect(clampCell({ x: -3, y: 2 }, 10, 10)).toEqual({ x: 0, y: 2 });
    expect(clampCell({ x: 99, y: 99 }, 10, 8)).toEqual({ x: 9, y: 7 });
  });
});

describe("chebyshev / sameCell", () => {
  it("treats diagonal as a single step (5-5-5)", () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
  });

  it("detects identical cells", () => {
    expect(sameCell({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(sameCell({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(false);
  });
});

describe("reachableCells", () => {
  const inBounds = (cols: number, rows: number) => (c: Cell) =>
    c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows;
  const never = () => false;

  it("returns the chebyshev disc (minus origin) on an open field", () => {
    const cells = reachableCells({ x: 5, y: 5 }, 2, inBounds(11, 11), never);
    // A 5x5 block centered on origin, minus the origin itself = 24 cells.
    expect(cells).toHaveLength(24);
    expect(cells.every((c) => chebyshev(c, { x: 5, y: 5 }) <= 2)).toBe(true);
    expect(cells.some((c) => c.x === 5 && c.y === 5)).toBe(false);
  });

  it("never escapes the bounds", () => {
    const cells = reachableCells({ x: 0, y: 0 }, 3, inBounds(3, 3), never);
    expect(cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < 3 && c.y < 3)).toBe(
      true,
    );
    expect(cells).toHaveLength(8); // the rest of a 3x3 grid
  });

  it("flood-fills around a wall instead of through it", () => {
    // Wall column at x=1 (rows 0..2) with a gap at y=3 on a 5-wide grid.
    const wall = new Set(["1,0", "1,1", "1,2"]);
    const blocked = (c: Cell) => wall.has(`${c.x},${c.y}`);
    const cells = reachableCells({ x: 0, y: 0 }, 2, inBounds(5, 5), blocked);
    const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
    // Cannot reach (2,0): blocked by the wall within 2 steps going straight.
    expect(keys.has("2,0")).toBe(false);
    // Wall cells themselves are never reachable.
    expect(keys.has("1,0")).toBe(false);
  });

  it("returns nothing when there is no movement budget", () => {
    expect(reachableCells({ x: 2, y: 2 }, 0, inBounds(5, 5), never)).toEqual([]);
  });
});
