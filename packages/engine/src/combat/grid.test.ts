import { describe, expect, it } from "vitest";

import { chebyshev, distanceFeet, hasLineOfSight, lineCells } from "./grid";

describe("chebyshev / distanceFeet (5-5-5)", () => {
  it("treats diagonal steps as the same cost as orthogonal", () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(distanceFeet({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(15);
    expect(distanceFeet({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(20);
  });

  it("is zero for the same cell", () => {
    expect(distanceFeet({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe("lineCells", () => {
  it("includes both endpoints along a straight line", () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
});

describe("hasLineOfSight", () => {
  const wallAt = (cells: { x: number; y: number }[]) => (cell: {
    x: number;
    y: number;
  }) => cells.some((c) => c.x === cell.x && c.y === cell.y);

  it("sees an unobstructed target", () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, () => false)).toBe(true);
  });

  it("is blocked by a wall between the endpoints", () => {
    expect(
      hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, wallAt([{ x: 2, y: 0 }])),
    ).toBe(false);
  });

  it("ignores blocking on the endpoints themselves", () => {
    expect(
      hasLineOfSight(
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        wallAt([
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ]),
      ),
    ).toBe(true);
  });
});
