import { describe, expect, it } from "vitest";

import { createSeededRng, mulberry32, randomInt } from "./prng";

describe("createSeededRng", () => {
  it("produces identical streams for identical seeds", () => {
    const a = createSeededRng("seed");
    const b = createSeededRng("seed");
    const drawsA = Array.from({ length: 10 }, () => a());
    const drawsB = Array.from({ length: 10 }, () => b());
    expect(drawsA).toEqual(drawsB);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 10 }, createSeededRng("a"));
    const b = Array.from({ length: 10 }, createSeededRng("b"));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rng = createSeededRng("range");
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("randomInt", () => {
  it("respects inclusive bounds", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("can return both endpoints over enough draws", () => {
    const rng = createSeededRng("endpoints");
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(randomInt(rng, 1, 4));
    expect(seen).toEqual(new Set([1, 2, 3, 4]));
  });

  it("throws when max < min", () => {
    expect(() => randomInt(mulberry32(1), 5, 1)).toThrow();
  });
});
