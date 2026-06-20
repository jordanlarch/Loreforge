import { describe, expect, it } from "vitest";

import { criticalNotation, resolveHit } from "./attack";

describe("resolveHit", () => {
  it("hits and crits on a natural 20 regardless of AC", () => {
    expect(resolveHit(20, 22, 99)).toEqual({ hit: true, critical: true });
  });

  it("misses on a natural 1 regardless of total", () => {
    expect(resolveHit(1, 25, 5)).toEqual({ hit: false, critical: false });
  });

  it("hits when the total meets or beats AC", () => {
    expect(resolveHit(10, 15, 15)).toEqual({ hit: true, critical: false });
    expect(resolveHit(12, 17, 15)).toEqual({ hit: true, critical: false });
  });

  it("misses when the total is below AC", () => {
    expect(resolveHit(8, 14, 15)).toEqual({ hit: false, critical: false });
  });

  it("forceCrit upgrades a normal hit to a crit but never rescues a miss", () => {
    expect(resolveHit(12, 16, 15, { forceCrit: true })).toEqual({
      hit: true,
      critical: true,
    });
    expect(resolveHit(8, 9, 15, { forceCrit: true })).toEqual({
      hit: false,
      critical: false,
    });
    expect(resolveHit(1, 30, 5, { forceCrit: true })).toEqual({
      hit: false,
      critical: false,
    });
  });
});

describe("criticalNotation", () => {
  it("doubles the dice count and keeps the modifier", () => {
    expect(criticalNotation("1d8+3")).toBe("2d8+3");
    expect(criticalNotation("2d6")).toBe("4d6");
    expect(criticalNotation("1d12-1")).toBe("2d12-1");
  });

  it("treats a bare die as a single die", () => {
    expect(criticalNotation("d10+2")).toBe("2d10+2");
  });
});
