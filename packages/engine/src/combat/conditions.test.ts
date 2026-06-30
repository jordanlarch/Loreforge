import { describe, expect, it } from "vitest";

import {
  attackedMode,
  charmedSources,
  checkMode,
  combineMode,
  critsWhenAdjacent,
  effectiveSpeed,
  exhaustionD20Penalty,
  frightenedSources,
  isIncapacitated,
  isProne,
  ownAttackMode,
  saveResolution,
  type ConditionState,
} from "./conditions";

const c = (condition: ConditionState["condition"], extra: Partial<ConditionState> = {}): ConditionState => ({
  condition,
  ...extra,
});

describe("combineMode", () => {
  it("cancels advantage and disadvantage to normal", () => {
    expect(combineMode("advantage", "disadvantage")).toBe("normal");
    expect(combineMode("advantage", "advantage")).toBe("advantage");
    expect(combineMode("disadvantage", "normal")).toBe("disadvantage");
    expect(combineMode("normal")).toBe("normal");
  });
});

describe("effectiveSpeed", () => {
  it("zeroes speed for grappled / restrained", () => {
    expect(effectiveSpeed(30, [c("grappled")])).toBe(0);
    expect(effectiveSpeed(30, [c("restrained")])).toBe(0);
  });
  // SRD 5.2.1 uniform exhaustion: −5 ft of Speed per level (not the 2014 tiers).
  it("reduces speed by 5 ft per exhaustion level", () => {
    expect(effectiveSpeed(30, [c("exhaustion", { level: 1 })])).toBe(25);
    expect(effectiveSpeed(30, [c("exhaustion", { level: 2 })])).toBe(20);
    expect(effectiveSpeed(30, [c("exhaustion", { level: 6 })])).toBe(0);
  });
  it("never goes below zero", () => {
    expect(effectiveSpeed(20, [c("exhaustion", { level: 5 })])).toBe(0);
  });
  it("is unchanged with no relevant condition", () => {
    expect(effectiveSpeed(30, [c("poisoned")])).toBe(30);
  });
});

describe("exhaustionD20Penalty", () => {
  // SRD 5.2.1: every D20 Test is reduced by 2 × the exhaustion level.
  it("is 2 × the exhaustion level", () => {
    expect(exhaustionD20Penalty([])).toBe(0);
    expect(exhaustionD20Penalty([c("exhaustion", { level: 1 })])).toBe(2);
    expect(exhaustionD20Penalty([c("exhaustion", { level: 3 })])).toBe(6);
  });
  it("does not turn exhaustion into roll disadvantage", () => {
    // The 2024 model is a flat penalty, not advantage/disadvantage.
    expect(ownAttackMode([c("exhaustion", { level: 5 })])).toBe("normal");
    expect(saveResolution("con", [c("exhaustion", { level: 5 })]).mode).toBe(
      "normal",
    );
  });
});

describe("ownAttackMode", () => {
  it("gives disadvantage when poisoned / blinded / prone", () => {
    for (const cond of ["poisoned", "blinded", "prone"] as const) {
      expect(ownAttackMode([c(cond)])).toBe("disadvantage");
    }
  });
  it("does not apply frightened without line-of-sight gating (see ownAttackModeForEntity)", () => {
    expect(ownAttackMode([c("frightened", { source: "npc:dragon" })])).toBe(
      "normal",
    );
  });
  it("gives advantage when invisible", () => {
    expect(ownAttackMode([c("invisible")])).toBe("advantage");
  });
  it("is unaffected by exhaustion (now a flat D20 penalty)", () => {
    expect(ownAttackMode([c("exhaustion", { level: 3 })])).toBe("normal");
  });
});

describe("checkMode", () => {
  it("does not apply frightened without line-of-sight gating (see checkModeForEntity)", () => {
    expect(checkMode([c("frightened", { source: "npc:dragon" })])).toBe(
      "normal",
    );
  });
  it("is normal for conditions without a check rider", () => {
    expect(checkMode([c("poisoned")])).toBe("normal");
    expect(checkMode([c("exhaustion", { level: 4 })])).toBe("normal");
  });
});

describe("frightenedSources", () => {
  it("collects fear sources the creature can't approach", () => {
    expect(
      frightenedSources([c("frightened", { source: "npc:dragon" })]),
    ).toEqual(new Set(["npc:dragon"]));
  });
  it("ignores frightened instances with no recorded source", () => {
    expect(frightenedSources([c("frightened")])).toEqual(new Set());
  });
});

describe("attackedMode", () => {
  it("gives attackers advantage vs paralyzed / restrained / stunned / unconscious", () => {
    for (const cond of ["paralyzed", "restrained", "stunned", "unconscious"] as const) {
      expect(attackedMode([c(cond)])).toBe("advantage");
    }
  });
  it("gives attackers disadvantage vs invisible", () => {
    expect(attackedMode([c("invisible")])).toBe("disadvantage");
  });
});

describe("isIncapacitated", () => {
  it("is true for incapacitating conditions", () => {
    for (const cond of ["incapacitated", "stunned", "paralyzed", "unconscious", "petrified"] as const) {
      expect(isIncapacitated([c(cond)])).toBe(true);
    }
  });
  it("is false for non-incapacitating conditions", () => {
    expect(isIncapacitated([c("poisoned"), c("prone")])).toBe(false);
  });
});

describe("saveResolution", () => {
  it("auto-fails STR/DEX saves while paralyzed", () => {
    expect(saveResolution("str", [c("paralyzed")]).autoFail).toBe(true);
    expect(saveResolution("dex", [c("paralyzed")]).autoFail).toBe(true);
    expect(saveResolution("con", [c("paralyzed")]).autoFail).toBe(false);
  });
  it("gives disadvantage on DEX saves while restrained", () => {
    expect(saveResolution("dex", [c("restrained")]).mode).toBe("disadvantage");
    expect(saveResolution("str", [c("restrained")]).mode).toBe("normal");
  });
  it("does not give save disadvantage from exhaustion (now a flat penalty)", () => {
    expect(saveResolution("con", [c("exhaustion", { level: 3 })]).mode).toBe(
      "normal",
    );
  });
});

describe("misc resolvers", () => {
  it("charmedSources collects the charmers", () => {
    expect(charmedSources([c("charmed", { source: "npc:siren" })])).toEqual(
      new Set(["npc:siren"]),
    );
  });
  it("critsWhenAdjacent for paralyzed / unconscious", () => {
    expect(critsWhenAdjacent([c("paralyzed")])).toBe(true);
    expect(critsWhenAdjacent([c("unconscious")])).toBe(true);
    expect(critsWhenAdjacent([c("prone")])).toBe(false);
  });
  it("isProne for prone / unconscious", () => {
    expect(isProne([c("prone")])).toBe(true);
    expect(isProne([c("unconscious")])).toBe(true);
    expect(isProne([c("poisoned")])).toBe(false);
  });
});
