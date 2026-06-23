import { describe, expect, it } from "vitest";

import {
  encounterMultiplier,
  partyThresholds,
  rateEncounter,
} from "./encounter-budget";

describe("encounterMultiplier", () => {
  it("scales with the foe-count bands (standard party of 4)", () => {
    expect(encounterMultiplier(1, 4)).toBe(1);
    expect(encounterMultiplier(2, 4)).toBe(1.5);
    expect(encounterMultiplier(3, 4)).toBe(2);
    expect(encounterMultiplier(6, 4)).toBe(2);
    expect(encounterMultiplier(7, 4)).toBe(2.5);
    expect(encounterMultiplier(11, 4)).toBe(3);
    expect(encounterMultiplier(15, 4)).toBe(4);
  });

  it("shifts one step harder for a small party (<3)", () => {
    expect(encounterMultiplier(1, 2)).toBe(1.5);
    expect(encounterMultiplier(3, 2)).toBe(2.5);
  });

  it("shifts one step easier for a large party (>=6)", () => {
    expect(encounterMultiplier(3, 6)).toBe(1.5);
    expect(encounterMultiplier(1, 6)).toBe(1);
  });

  it("returns 1 for no foes", () => {
    expect(encounterMultiplier(0, 4)).toBe(1);
  });
});

describe("partyThresholds", () => {
  it("sums per-character thresholds across levels", () => {
    expect(partyThresholds([4, 4, 4, 4])).toEqual({
      easy: 500,
      medium: 1000,
      hard: 1500,
      deadly: 2000,
    });
  });

  it("clamps out-of-range levels into 1..20", () => {
    expect(partyThresholds([0, 99])).toEqual({
      easy: 25 + 2800,
      medium: 50 + 5700,
      hard: 75 + 8500,
      deadly: 100 + 12700,
    });
  });

  it("is all zeros for an empty party", () => {
    expect(partyThresholds([])).toEqual({
      easy: 0,
      medium: 0,
      hard: 0,
      deadly: 0,
    });
  });
});

describe("rateEncounter", () => {
  const party = [1, 1, 1, 1]; // thresholds: easy 100, medium 200, hard 300, deadly 400

  it("rates a light fight as easy", () => {
    // 2 goblins (50 each) → raw 100, ×1.5 → 150 (>= easy 100, < medium 200)
    const r = rateEncounter(party, [50, 50]);
    expect(r.rawXp).toBe(100);
    expect(r.multiplier).toBe(1.5);
    expect(r.adjustedXp).toBe(150);
    expect(r.difficulty).toBe("easy");
  });

  it("rates a mixed pair as medium", () => {
    // orc (100) + goblin (50) → raw 150, ×1.5 → 225 (>= medium 200, < hard 300)
    const r = rateEncounter(party, [100, 50]);
    expect(r.adjustedXp).toBe(225);
    expect(r.difficulty).toBe("medium");
  });

  it("rates a swarm as hard", () => {
    // 3 goblins (50 each) → raw 150, ×2 → 300 (>= hard 300, < deadly 400)
    const r = rateEncounter(party, [50, 50, 50]);
    expect(r.foeCount).toBe(3);
    expect(r.multiplier).toBe(2);
    expect(r.adjustedXp).toBe(300);
    expect(r.difficulty).toBe("hard");
  });

  it("rates a solo ogre as deadly", () => {
    // ogre (450) → raw 450, ×1 → 450 (>= deadly 400)
    const r = rateEncounter(party, [450]);
    expect(r.difficulty).toBe("deadly");
  });

  it("rates a trivial fight below the easy floor", () => {
    // 1 bandit (25) → raw 25, ×1 → 25 (< easy 100)
    const r = rateEncounter(party, [25]);
    expect(r.difficulty).toBe("trivial");
  });

  it("returns unknown when there is no party", () => {
    const r = rateEncounter([], [50, 50]);
    expect(r.difficulty).toBe("unknown");
    expect(r.thresholds).toEqual({ easy: 0, medium: 0, hard: 0, deadly: 0 });
  });

  it("rates an empty roster against a real party as trivial", () => {
    const r = rateEncounter([4, 4], []);
    expect(r.rawXp).toBe(0);
    expect(r.adjustedXp).toBe(0);
    expect(r.difficulty).toBe("trivial");
  });
});
