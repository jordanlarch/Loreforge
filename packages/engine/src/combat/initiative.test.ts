import { describe, expect, it } from "vitest";

import { freshActionEconomy, sortInitiative } from "./initiative";

describe("sortInitiative", () => {
  it("orders by initiative descending", () => {
    const order = sortInitiative([
      { entity: "a", initiative: 12, dexScore: 10, tiebreak: 1 },
      { entity: "b", initiative: 20, dexScore: 10, tiebreak: 1 },
      { entity: "c", initiative: 15, dexScore: 10, tiebreak: 1 },
    ]);
    expect(order.map((e) => e.entity)).toEqual(["b", "c", "a"]);
  });

  it("breaks an initiative tie by DEX score", () => {
    const order = sortInitiative([
      { entity: "low-dex", initiative: 18, dexScore: 12, tiebreak: 20 },
      { entity: "high-dex", initiative: 18, dexScore: 16, tiebreak: 1 },
    ]);
    expect(order.map((e) => e.entity)).toEqual(["high-dex", "low-dex"]);
  });

  it("breaks an initiative+DEX tie by the seeded tiebreak roll", () => {
    const order = sortInitiative([
      { entity: "rolled-low", initiative: 18, dexScore: 14, tiebreak: 3 },
      { entity: "rolled-high", initiative: 18, dexScore: 14, tiebreak: 17 },
    ]);
    expect(order.map((e) => e.entity)).toEqual(["rolled-high", "rolled-low"]);
  });

  it("falls back to a stable id ordering when everything ties", () => {
    const order = sortInitiative([
      { entity: "zed", initiative: 10, dexScore: 10, tiebreak: 5 },
      { entity: "ana", initiative: 10, dexScore: 10, tiebreak: 5 },
    ]);
    expect(order.map((e) => e.entity)).toEqual(["ana", "zed"]);
  });

  it("does not mutate its input", () => {
    const input = [
      { entity: "a", initiative: 1, dexScore: 10, tiebreak: 1 },
      { entity: "b", initiative: 2, dexScore: 10, tiebreak: 1 },
    ];
    sortInitiative(input);
    expect(input.map((e) => e.entity)).toEqual(["a", "b"]);
  });
});

describe("freshActionEconomy", () => {
  it("starts every resource available with full movement", () => {
    expect(freshActionEconomy(30)).toEqual({
      action: "available",
      bonusAction: "available",
      movement: { used: 0, total: 30 },
      attacks: { used: 0, total: 1 },
      freeInteractionUsed: false,
    });
  });

  it("seeds the attack budget from the attacks-per-action argument", () => {
    expect(freshActionEconomy(30, 3).attacks).toEqual({ used: 0, total: 3 });
    expect(freshActionEconomy(30, 0).attacks.total).toBe(1);
  });

  it("clamps negative speed to zero movement", () => {
    expect(freshActionEconomy(-5).movement.total).toBe(0);
  });
});
