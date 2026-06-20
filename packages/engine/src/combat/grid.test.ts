import { describe, expect, it } from "vitest";

import {
  chebyshev,
  distanceFeet,
  hasLineOfSight,
  lineCells,
  withinBurst,
  withinCone,
} from "./grid";

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

describe("withinBurst (sphere / radius)", () => {
  const center = { x: 5, y: 5 };
  it("includes the center and cells within the radius (Chebyshev)", () => {
    // 20-ft radius = 4 cells.
    expect(withinBurst(center, { x: 5, y: 5 }, 20)).toBe(true);
    expect(withinBurst(center, { x: 9, y: 5 }, 20)).toBe(true); // 4 cells
    expect(withinBurst(center, { x: 9, y: 9 }, 20)).toBe(true); // 4 cells diag
  });
  it("excludes cells beyond the radius", () => {
    expect(withinBurst(center, { x: 10, y: 5 }, 20)).toBe(false); // 5 cells = 25ft
  });
});

describe("withinCone", () => {
  const apex = { x: 0, y: 0 };
  const toward = { x: 1, y: 0 }; // aimed east, 15-ft cone = 3 cells
  it("never catches the apex", () => {
    expect(withinCone(apex, toward, apex, 15)).toBe(false);
  });
  it("catches cells straight ahead within the length", () => {
    expect(withinCone(apex, toward, { x: 1, y: 0 }, 15)).toBe(true);
    expect(withinCone(apex, toward, { x: 3, y: 0 }, 15)).toBe(true);
  });
  it("excludes cells beyond the length", () => {
    expect(withinCone(apex, toward, { x: 4, y: 0 }, 15)).toBe(false);
  });
  it("excludes cells outside the half-angle (too far off-axis)", () => {
    expect(withinCone(apex, toward, { x: 1, y: 1 }, 15)).toBe(false);
  });
  it("excludes cells behind the apex", () => {
    expect(withinCone(apex, toward, { x: -1, y: 0 }, 15)).toBe(false);
  });
  it("returns false with no aim direction", () => {
    expect(withinCone(apex, apex, { x: 1, y: 0 }, 15)).toBe(false);
  });
});
