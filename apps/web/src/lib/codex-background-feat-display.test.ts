import { describe, expect, it } from "vitest";

import {
  backgroundSkillProficiencies,
} from "./codex-background-feat-display";

describe("backgroundSkillProficiencies", () => {
  it("parses skill_proficiency benefits into SRD skill names", () => {
    expect(
      backgroundSkillProficiencies({
        benefits: [
          {
            name: "Skill Proficiencies",
            type: "skill_proficiency",
            desc: "Insight and Religion",
          },
        ],
      }),
    ).toEqual(["Insight", "Religion"]);
  });

  it("returns empty when benefits are missing or unstructured", () => {
    expect(backgroundSkillProficiencies({})).toEqual([]);
    expect(
      backgroundSkillProficiencies({
        benefits: [{ type: "skill_proficiency", desc: "Not a real skill" }],
      }),
    ).toEqual([]);
  });
});
