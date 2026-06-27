import { describe, expect, it } from "vitest";

import {
  codexCategoryPath,
  codexDeepLink,
  codexDetailPath,
  codexPathWithQuery,
  legacyCodexSearchParamsToPath,
  parseCodexCategorySegment,
} from "./codex-routes";

describe("parseCodexCategorySegment", () => {
  it("maps URL segments to categories", () => {
    expect(parseCodexCategorySegment("spells")).toBe("Spells");
    expect(parseCodexCategorySegment("SPELLS")).toBe("Spells");
    expect(parseCodexCategorySegment("feats")).toBe("Feats");
    expect(parseCodexCategorySegment("nope")).toBeNull();
  });
});

describe("codex paths", () => {
  it("builds list paths with optional search", () => {
    expect(codexCategoryPath("Spells")).toBe("/codex/spells");
    expect(codexCategoryPath("Items", "sword")).toBe(
      "/codex/items?search=sword",
    );
  });

  it("builds detail paths with encoding", () => {
    expect(codexDeepLink("Feats", "srd-2024_alert")).toBe(
      "/codex/feats/srd-2024_alert",
    );
    expect(codexDetailPath("Spells", "fire ball")).toBe(
      "/codex/spells/fire%20ball",
    );
  });

  it("preserves query string when opening detail from filtered list", () => {
    expect(
      codexPathWithQuery(
        codexDetailPath("Spells", "fireball"),
        "level=3&school=evocation",
      ),
    ).toBe("/codex/spells/fireball?level=3&school=evocation");
    expect(codexPathWithQuery("/codex/spells", "")).toBe("/codex/spells");
  });
});

describe("legacyCodexSearchParamsToPath", () => {
  it("redirects legacy query links to path routes", () => {
    expect(
      legacyCodexSearchParamsToPath({ category: "Spells", slug: "fireball" }),
    ).toBe("/codex/spells/fireball");
    expect(legacyCodexSearchParamsToPath({ category: "Species" })).toBe(
      "/codex/species",
    );
    expect(legacyCodexSearchParamsToPath({ search: "fire" })).toBe(
      "/codex/spells?search=fire",
    );
    expect(legacyCodexSearchParamsToPath({})).toBe("/codex/spells");
  });
});
