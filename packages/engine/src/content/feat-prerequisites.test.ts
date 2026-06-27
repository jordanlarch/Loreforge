import { describe, expect, it } from "vitest";

import {
  featIneligibilityReason,
  featMeetsPrerequisite,
} from "./feat-prerequisites";

const scores = {
  str: 14,
  dex: 12,
  con: 14,
  int: 10,
  wis: 13,
  cha: 8,
};

describe("featMeetsPrerequisite", () => {
  it("allows feats with no prerequisite", () => {
    expect(
      featMeetsPrerequisite(null, { characterLevel: 4, abilityScores: scores }),
    ).toBe(true);
  });

  it("blocks high-level feats", () => {
    expect(
      featMeetsPrerequisite("Level 19", {
        characterLevel: 4,
        abilityScores: scores,
      }),
    ).toBe(false);
    expect(
      featMeetsPrerequisite("Level 19", {
        characterLevel: 19,
        abilityScores: scores,
      }),
    ).toBe(true);
  });

  it("parses ordinal level requirements", () => {
    expect(
      featMeetsPrerequisite("Fourth level or higher", {
        characterLevel: 3,
        abilityScores: scores,
      }),
    ).toBe(false);
    expect(
      featMeetsPrerequisite("Fourth level or higher", {
        characterLevel: 4,
        abilityScores: scores,
      }),
    ).toBe(true);
  });

  it("checks ability score minimums", () => {
    expect(
      featMeetsPrerequisite("Strength 13 or higher", {
        characterLevel: 4,
        abilityScores: scores,
      }),
    ).toBe(true);
    expect(
      featMeetsPrerequisite("Dexterity 13 or higher", {
        characterLevel: 4,
        abilityScores: scores,
      }),
    ).toBe(false);
  });

  it("returns prerequisite text as reason", () => {
    expect(
      featIneligibilityReason("Level 19", {
        characterLevel: 4,
        abilityScores: scores,
      }),
    ).toBe("Level 19");
  });
});
