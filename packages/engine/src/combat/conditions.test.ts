import { describe, expect, it } from "vitest";

import {
  attackedMode,
  charmedSources,
  combineMode,
  critsWhenAdjacent,
  effectiveSpeed,
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
  it("halves at exhaustion 2 and zeroes at 5", () => {
    expect(effectiveSpeed(30, [c("exhaustion", { level: 2 })])).toBe(15);
    expect(effectiveSpeed(30, [c("exhaustion", { level: 5 })])).toBe(0);
  });
  it("is unchanged with no relevant condition", () => {
    expect(effectiveSpeed(30, [c("poisoned")])).toBe(30);
  });
});

describe("ownAttackMode", () => {
  it("gives disadvantage when poisoned / blinded / frightened / prone", () => {
    for (const cond of ["poisoned", "blinded", "frightened", "prone"] as const) {
      expect(ownAttackMode([c(cond)])).toBe("disadvantage");
    }
  });
  it("gives advantage when invisible", () => {
    expect(ownAttackMode([c("invisible")])).toBe("advantage");
  });
  it("gives disadvantage at exhaustion 3", () => {
    expect(ownAttackMode([c("exhaustion", { level: 3 })])).toBe("disadvantage");
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
  it("gives disadvantage on all saves at exhaustion 3", () => {
    expect(saveResolution("con", [c("exhaustion", { level: 3 })]).mode).toBe(
      "disadvantage",
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
