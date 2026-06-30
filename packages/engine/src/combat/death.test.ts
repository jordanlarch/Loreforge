import { describe, expect, it } from "vitest";

import {
  concentrationDC,
  failuresFromDamageAtZeroHp,
  isInstantDeathFromDamage,
  overflowDamageWhenDropped,
  resolveDeathSave,
} from "./death";

describe("resolveDeathSave", () => {
  it("counts a roll of 10+ as one success", () => {
    expect(resolveDeathSave(10, { successes: 0, failures: 0 })).toEqual({
      successes: 1,
      failures: 0,
      stable: false,
      dead: false,
      revived: false,
    });
  });

  it("counts a roll below 10 as one failure", () => {
    expect(resolveDeathSave(9, { successes: 0, failures: 0 })).toEqual({
      successes: 0,
      failures: 1,
      stable: false,
      dead: false,
      revived: false,
    });
  });

  it("counts a natural 1 as two failures", () => {
    const res = resolveDeathSave(1, { successes: 0, failures: 0 });
    expect(res.failures).toBe(2);
    expect(res.dead).toBe(false);
  });

  it("a natural 1 from one failure kills (3 total)", () => {
    const res = resolveDeathSave(1, { successes: 0, failures: 1 });
    expect(res.failures).toBe(3);
    expect(res.dead).toBe(true);
  });

  it("stabilizes on the third success", () => {
    const res = resolveDeathSave(15, { successes: 2, failures: 0 });
    expect(res.successes).toBe(3);
    expect(res.stable).toBe(true);
    expect(res.dead).toBe(false);
  });

  it("dies on the third failure", () => {
    const res = resolveDeathSave(5, { successes: 1, failures: 2 });
    expect(res.failures).toBe(3);
    expect(res.dead).toBe(true);
    expect(res.stable).toBe(false);
  });

  it("revives with a natural 20 and clears the tally", () => {
    expect(resolveDeathSave(20, { successes: 1, failures: 2 })).toEqual({
      successes: 0,
      failures: 0,
      stable: false,
      dead: false,
      revived: true,
    });
  });

  it("clamps tallies to 3", () => {
    const res = resolveDeathSave(1, { successes: 0, failures: 2 });
    expect(res.failures).toBe(3);
  });
});

describe("instant death overflow", () => {
  it("counts overflow when dropping from partial HP", () => {
    expect(overflowDamageWhenDropped(18, 6, 0)).toBe(12);
    expect(
      isInstantDeathFromDamage(18, 12, 6, 0, 0),
    ).toBe(true);
  });

  it("does not instant-kill when overflow is below max HP", () => {
    expect(overflowDamageWhenDropped(20, 10, 0)).toBe(10);
    expect(
      isInstantDeathFromDamage(20, 22, 10, 0, 0),
    ).toBe(false);
  });
});

describe("failuresFromDamageAtZeroHp", () => {
  it("doubles failures on a critical hit", () => {
    expect(failuresFromDamageAtZeroHp(false)).toBe(1);
    expect(failuresFromDamageAtZeroHp(true)).toBe(2);
  });
});

describe("concentrationDC", () => {
  it("is at least 10 for small hits", () => {
    expect(concentrationDC(1)).toBe(10);
    expect(concentrationDC(18)).toBe(10);
  });

  it("is half the damage (rounded down) for big hits", () => {
    expect(concentrationDC(20)).toBe(10);
    expect(concentrationDC(21)).toBe(10);
    expect(concentrationDC(22)).toBe(11);
    expect(concentrationDC(45)).toBe(22);
  });
});
