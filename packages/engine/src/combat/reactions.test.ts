import { describe, expect, it } from "vitest";

import { areHostile, provokesOpportunityAttack, REACH_FEET, readyTriggerRangeFeet } from "./reactions";

describe("provokesOpportunityAttack", () => {
  const threatener = { x: 0, y: 0 };

  it("provokes when leaving the threatener's reach", () => {
    // Adjacent (5 ft) -> two cells away (10 ft).
    expect(
      provokesOpportunityAttack(threatener, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBe(true);
  });

  it("does not provoke when moving within reach", () => {
    // Adjacent -> still adjacent (diagonal, 5 ft under 5-5-5).
    expect(
      provokesOpportunityAttack(threatener, { x: 1, y: 0 }, { x: 1, y: 1 }),
    ).toBe(false);
  });

  it("does not provoke when starting outside reach", () => {
    expect(
      provokesOpportunityAttack(threatener, { x: 2, y: 0 }, { x: 3, y: 0 }),
    ).toBe(false);
  });

  it("does not provoke when moving closer", () => {
    expect(
      provokesOpportunityAttack(threatener, { x: 2, y: 0 }, { x: 1, y: 0 }),
    ).toBe(false);
  });

  it("respects a larger reach", () => {
    // 10 ft reacher: leaving from 10 ft (2 cells) to 15 ft (3 cells) provokes.
    expect(
      provokesOpportunityAttack(threatener, { x: 2, y: 0 }, { x: 3, y: 0 }, 10),
    ).toBe(true);
    expect(
      provokesOpportunityAttack(threatener, { x: 1, y: 0 }, { x: 2, y: 0 }, 10),
    ).toBe(false);
  });

  it("defaults reach to 5 ft", () => {
    expect(REACH_FEET).toBe(5);
  });
});

describe("readyTriggerRangeFeet", () => {
  it("parses in_range triggers", () => {
    expect(readyTriggerRangeFeet("in_range:80")).toBe(80);
    expect(readyTriggerRangeFeet("in_range:10")).toBe(10);
  });

  it("falls back to melee reach for unknown triggers", () => {
    expect(readyTriggerRangeFeet("when the foe enters reach")).toBe(5);
  });
});

describe("areHostile", () => {
  it("is hostile when both sides are defined and differ", () => {
    expect(areHostile("party", "enemies")).toBe(true);
    expect(areHostile("goblins", "cult")).toBe(true);
  });

  it("is not hostile for the same side", () => {
    expect(areHostile("party", "party")).toBe(false);
  });

  it("treats an unassigned side as neutral", () => {
    expect(areHostile(undefined, "enemies")).toBe(false);
    expect(areHostile("party", undefined)).toBe(false);
    expect(areHostile(undefined, undefined)).toBe(false);
  });
});
