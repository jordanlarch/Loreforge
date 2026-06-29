import { describe, expect, it } from "vitest";

import { coverBetween, coverBonus } from "./cover";

describe("coverBetween", () => {
  const wall = { x: 5, y: 5 };

  it("returns none with a clear line", () => {
    expect(
      coverBetween({ x: 0, y: 0 }, { x: 4, y: 0 }, () => false),
    ).toBe("none");
  });

  it("returns half with one intervening cover cell", () => {
    expect(
      coverBetween(
        { x: 0, y: 5 },
        { x: 10, y: 5 },
        (cell) => cell.x === wall.x && cell.y === wall.y,
      ),
    ).toBe("half");
  });

  it("returns three-quarters with two intervening cover cells", () => {
    expect(
      coverBetween(
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        (cell) => cell.x === cell.y && cell.x > 0 && cell.x < 4,
      ),
    ).toBe("three_quarters");
  });

  it("maps tiers to SRD bonuses", () => {
    expect(coverBonus("none")).toBe(0);
    expect(coverBonus("half")).toBe(2);
    expect(coverBonus("three_quarters")).toBe(5);
  });
});
