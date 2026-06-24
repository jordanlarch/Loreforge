import { describe, expect, it } from "vitest";

import {
  open5eKeyToSlug,
  ruleSectionToRow,
  rulesetToChapterRow,
} from "./open5e-rules";

describe("open5e-rules", () => {
  it("converts Open5e keys to slugs", () => {
    expect(open5eKeyToSlug("srd-2024_combat")).toBe("srd-2024_combat");
    expect(open5eKeyToSlug("foo/bar")).toBe("foo-bar");
  });

  it("maps Open5e ruleset JSON to chapter row shape", () => {
    expect(
      rulesetToChapterRow(
        {
          key: "srd-2024_combat",
          name: "Combat",
          desc: "Rules for fighting.",
          rules: [{ key: "srd-2024_combat_initiative", name: "Initiative", desc: "Roll." }],
        },
        3,
      ),
    ).toEqual({
      slug: "srd-2024_combat",
      name: "Combat",
      description: "Rules for fighting.",
      sortIndex: 3,
      source: "open5e",
      raw: expect.objectContaining({ name: "Combat" }),
    });
  });

  it("maps Open5e rule section JSON to section row shape", () => {
    expect(
      ruleSectionToRow(
        {
          key: "srd-2024_combat_initiative",
          name: "Initiative",
          desc: "Everyone rolls.",
        },
        "srd-2024_combat",
        1,
      ),
    ).toEqual({
      slug: "srd-2024_combat_initiative",
      name: "Initiative",
      description: "Everyone rolls.",
      chapterSlug: "srd-2024_combat",
      sortIndex: 1,
      source: "open5e",
      raw: expect.objectContaining({ name: "Initiative" }),
    });
  });
});
