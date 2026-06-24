import { describe, expect, it } from "vitest";

import { backgroundToRow } from "./open5e-backgrounds";
import { featToRow } from "./open5e-feats";

describe("open5e-backgrounds", () => {
  it("maps Open5e background JSON to codex row shape", () => {
    expect(
      backgroundToRow({
        key: "srd-2024_acolyte",
        name: "Acolyte",
        desc: "You served in a temple.",
        benefits: [{ name: "Skill Proficiencies", desc: "Insight and Religion" }],
      }),
    ).toEqual({
      slug: "srd-2024_acolyte",
      name: "Acolyte",
      description: "You served in a temple.",
      source: "open5e",
      raw: expect.objectContaining({ name: "Acolyte" }),
    });
  });
});

describe("open5e-feats", () => {
  it("maps Open5e feat JSON to codex row shape", () => {
    expect(
      featToRow({
        key: "srd-2024_alert",
        name: "Alert",
        desc: "You gain the following benefits.",
        prerequisite: "",
        type: "Origin",
        benefits: [{ desc: "When you roll Initiative, you can add your Proficiency Bonus." }],
      }),
    ).toEqual({
      slug: "srd-2024_alert",
      name: "Alert",
      description: "You gain the following benefits.",
      prerequisite: null,
      featType: "Origin",
      source: "open5e",
      raw: expect.objectContaining({ name: "Alert" }),
    });
  });
});
