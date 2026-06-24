import { describe, expect, it } from "vitest";

import {
  creatureToRow,
  formatChallengeRating,
} from "./open5e-creatures";

describe("open5e-creatures", () => {
  it("formats challenge ratings for display", () => {
    expect(formatChallengeRating(0.125)).toBe("1/8");
    expect(formatChallengeRating(0.25)).toBe("1/4");
    expect(formatChallengeRating(0.5)).toBe("1/2");
    expect(formatChallengeRating(10)).toBe("10");
  });

  it("maps Open5e creature JSON to codex row shape", () => {
    expect(
      creatureToRow({
        key: "srd_wolf",
        name: "Wolf",
        type: { key: "beast", name: "Beast" },
        size: { key: "medium", name: "Medium" },
        challenge_rating: 0.25,
        armor_class: 13,
        hit_points: 11,
        alignment: "unaligned",
      }),
    ).toEqual({
      slug: "srd_wolf",
      name: "Wolf",
      creatureType: "beast",
      size: "medium",
      challengeRating: 0.25,
      armorClass: 13,
      hitPoints: 11,
      alignment: "unaligned",
      source: "open5e",
      raw: expect.objectContaining({ name: "Wolf" }),
    });
  });
});
