import { describe, expect, it } from "vitest";

import { parseDice, rollD20, rollDice } from "./dice";
import { createSeededRng } from "./prng";

describe("parseDice", () => {
  it("parses a bare die", () => {
    expect(parseDice("d20")).toMatchObject({ count: 1, sides: 20, modifier: 0 });
  });

  it("parses count, sides, and positive modifier", () => {
    expect(parseDice("2d6+3")).toMatchObject({
      count: 2,
      sides: 6,
      modifier: 3,
    });
  });

  it("parses a negative modifier with spaces", () => {
    expect(parseDice("1d8 - 2")).toMatchObject({
      count: 1,
      sides: 8,
      modifier: -2,
    });
  });

  it("parses keep-highest (ability score generation)", () => {
    expect(parseDice("4d6kh3")).toMatchObject({
      count: 4,
      sides: 6,
      keepHighest: 3,
    });
  });

  it("parses keep-lowest", () => {
    expect(parseDice("2d20kl1")).toMatchObject({
      count: 2,
      sides: 20,
      keepLowest: 1,
    });
  });

  it("rejects malformed notation", () => {
    expect(() => parseDice("banana")).toThrow();
    expect(() => parseDice("d0")).toThrow();
    expect(() => parseDice("0d6")).toThrow();
  });

  it("rejects keeping more dice than rolled", () => {
    expect(() => parseDice("2d6kh3")).toThrow();
  });
});

describe("rollDice", () => {
  it("is deterministic for a fixed seed", () => {
    const a = rollDice("3d6+2", createSeededRng("campaign-1:scope"));
    const b = rollDice("3d6+2", createSeededRng("campaign-1:scope"));
    expect(a).toEqual(b);
  });

  it("differs across distinct seeds", () => {
    const a = rollDice("20d20", createSeededRng("seed-a"));
    const b = rollDice("20d20", createSeededRng("seed-b"));
    expect(a.rolls).not.toEqual(b.rolls);
  });

  it("keeps every die within bounds and sums with modifier", () => {
    const rng = createSeededRng("bounds");
    for (let i = 0; i < 200; i++) {
      const roll = rollDice("4d6+1", rng);
      expect(roll.rolls).toHaveLength(4);
      for (const die of roll.rolls) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
      const expected =
        roll.rolls.reduce((sum, n) => sum + n, 0) + 1;
      expect(roll.total).toBe(expected);
    }
  });

  it("applies keep-highest correctly", () => {
    const rng = createSeededRng("keep");
    const roll = rollDice("4d6kh3", rng);
    expect(roll.kept).toHaveLength(3);
    const sortedDesc = [...roll.rolls].sort((a, b) => b - a).slice(0, 3);
    expect(roll.kept).toEqual(sortedDesc);
    expect(roll.total).toBe(sortedDesc.reduce((sum, n) => sum + n, 0));
  });
});

describe("rollD20", () => {
  it("advantage takes the higher of two rolls", () => {
    const rng = createSeededRng("adv");
    const result = rollD20(rng, { mode: "advantage", bonus: 5 });
    expect(result.rolls).toHaveLength(2);
    expect(result.natural).toBe(Math.max(...result.rolls));
    expect(result.total).toBe(result.natural + 5);
  });

  it("disadvantage takes the lower of two rolls", () => {
    const rng = createSeededRng("dis");
    const result = rollD20(rng, { mode: "disadvantage" });
    expect(result.natural).toBe(Math.min(...result.rolls));
  });

  it("normal mode rolls once", () => {
    const result = rollD20(createSeededRng("normal"));
    expect(result.rolls).toHaveLength(1);
    expect(result.mode).toBe("normal");
  });
});
