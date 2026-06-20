import { describe, expect, it } from "vitest";

import {
  hpFraction,
  TOKEN_COLORS,
  tokenBorderColor,
  tokenInitials,
} from "./tokens";

describe("tokenBorderColor", () => {
  it("colors player characters gold", () => {
    expect(tokenBorderColor("character", { alive: true, hostile: false })).toBe(
      TOKEN_COLORS.character,
    );
  });

  it("colors hostiles red and other NPCs neutral", () => {
    expect(tokenBorderColor("monster", { alive: true, hostile: true })).toBe(
      TOKEN_COLORS.hostile,
    );
    expect(tokenBorderColor("npc", { alive: true, hostile: false })).toBe(
      TOKEN_COLORS.neutral,
    );
  });

  it("washes out downed creatures regardless of kind", () => {
    expect(tokenBorderColor("character", { alive: false, hostile: false })).toBe(
      TOKEN_COLORS.downed,
    );
  });
});

describe("tokenInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(tokenInitials("Thorin Ironfist")).toBe("TI");
    expect(tokenInitials("Goblin Cutter")).toBe("GC");
  });

  it("falls back to two letters for a single word", () => {
    expect(tokenInitials("Strahd")).toBe("ST");
  });

  it("handles empty / whitespace names", () => {
    expect(tokenInitials("   ")).toBe("?");
  });
});

describe("hpFraction", () => {
  it("computes a clamped fraction", () => {
    expect(hpFraction(22, 44)).toBe(0.5);
    expect(hpFraction(-5, 44)).toBe(0);
    expect(hpFraction(99, 44)).toBe(1);
  });

  it("guards against a zero max", () => {
    expect(hpFraction(0, 0)).toBe(0);
  });
});
