import { describe, expect, it } from "vitest";

import {
  abilityScoreRows,
  formatChallengeRating,
  formatSpeedLine,
} from "./codex-monster-display";

describe("codex-monster-display", () => {
  it("formats CR and speed", () => {
    expect(formatChallengeRating(0.25)).toBe("1/4");
    expect(
      formatSpeedLine({
        speed: { walk: 40, swim: 30, unit: "feet" },
      }),
    ).toBe("walk 40 feet, swim 30 feet");
  });

  it("extracts ability score rows from Open5e raw", () => {
    const rows = abilityScoreRows({
      ability_scores: {
        strength: 17,
        dexterity: 12,
        constitution: 16,
        intelligence: 9,
        wisdom: 11,
        charisma: 8,
      },
      modifiers: {
        strength: 3,
        dexterity: 1,
        constitution: 3,
        intelligence: -1,
        wisdom: 0,
        charisma: -1,
      },
    });
    expect(rows.find((r) => r.abbr === "STR")).toEqual({
      abbr: "STR",
      score: 17,
      mod: 3,
    });
  });
});
