import { describe, expect, it } from "vitest";

import { codexSpellFlags, open5eRawFlag } from "./codex-spell-flags";

describe("codex-spell-flags", () => {
  it("parses yes/true concentration and ritual flags", () => {
    expect(
      codexSpellFlags({ concentration: "yes", ritual: "true" }),
    ).toEqual({ concentration: true, ritual: true });
  });

  it("returns false for missing or other values", () => {
    expect(open5eRawFlag({ concentration: "no" }, "concentration")).toBe(false);
    expect(codexSpellFlags(undefined)).toEqual({
      concentration: false,
      ritual: false,
    });
  });
});
