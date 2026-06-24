import { describe, expect, it } from "vitest";

import {
  normalizeEntityName,
  segmentBenefitDescription,
  type CodexLinkIndex,
} from "./codex-background-benefit-links";

const INDEX: CodexLinkIndex = {
  feats: [
    {
      slug: "srd-2024_alert",
      name: "Alert",
      preview: "You gain the following benefits.",
    },
  ],
  items: [
    {
      slug: "srd-2024_calligraphers-supplies",
      name: "Calligrapher's Supplies (50 GP)",
      preview: "Ability: Dexterity.",
    },
    {
      slug: "srd-2024_holy-symbol",
      name: "Holy Symbol",
      preview: "A holy symbol.",
    },
  ],
};

describe("codex-background-benefit-links", () => {
  it("normalizes parenthetical item names", () => {
    expect(normalizeEntityName("Calligrapher's Supplies (50 GP)")).toBe(
      "calligrapher's supplies",
    );
  });

  it("segments skill proficiencies into hint chips", () => {
    expect(
      segmentBenefitDescription(
        "Insight and Religion",
        "skill_proficiency",
        INDEX,
      ),
    ).toEqual([
      { kind: "skill", text: "Insight", skill: "Insight" },
      { kind: "text", text: " and " },
      { kind: "skill", text: "Religion", skill: "Religion" },
    ]);
  });

  it("links feat benefits when the feat exists in the Codex", () => {
    expect(segmentBenefitDescription("Alert", "feat", INDEX)).toEqual([
      {
        kind: "codex",
        text: "Alert",
        category: "Feats",
        slug: "srd-2024_alert",
        preview: "You gain the following benefits.",
      },
    ]);
  });

  it("links item names inside equipment lists", () => {
    const segments = segmentBenefitDescription(
      "Calligrapher's Supplies, Holy Symbol, 8 GP",
      "equipment",
      INDEX,
    );
    expect(segments.some((s) => s.kind === "codex" && s.slug.includes("calligrapher"))).toBe(
      true,
    );
    expect(segments.some((s) => s.kind === "codex" && s.text === "Holy Symbol")).toBe(
      true,
    );
  });
});
