import { describe, expect, it } from "vitest";

import {
  codexDeepLink,
  codexShareUrl,
  open5eSourceUrl,
  useInCharacterHref,
} from "./codex-detail-links";

describe("codexDeepLink", () => {
  it("builds path-based deep links", () => {
    expect(codexDeepLink("Spells", "fireball")).toBe("/codex/spells/fireball");
  });
});

describe("codexShareUrl", () => {
  it("prefixes the app origin", () => {
    expect(codexShareUrl("Feats", "alert", "https://app.test")).toBe(
      "https://app.test/codex/feats/alert",
    );
  });
});

describe("open5eSourceUrl", () => {
  it("maps Open5e categories to API records", () => {
    expect(open5eSourceUrl("Feats", "srd-2024_alert")).toBe(
      "https://api.open5e.com/v2/feats/srd-2024_alert/",
    );
    expect(
      open5eSourceUrl("Items", "longsword", { key: "srd-2024_longsword" }),
    ).toBe("https://api.open5e.com/v2/items/srd-2024_longsword/");
  });

  it("returns null for non-Open5e categories", () => {
    expect(open5eSourceUrl("Species", "hill-dwarf")).toBeNull();
  });
});

describe("useInCharacterActions", () => {
  it("links species, classes, and backgrounds to the creation wizard", () => {
    expect(useInCharacterHref("Species", "hill-dwarf")).toBe(
      "/characters/new?species=hill-dwarf",
    );
    expect(useInCharacterHref("Classes", "fighter")).toBe(
      "/characters/new?class=fighter",
    );
    expect(useInCharacterHref("Backgrounds", "folk-hero")).toBe(
      "/characters/new?background=folk-hero",
    );
    expect(useInCharacterHref("Feats", "alert")).toBe("/characters");
    expect(useInCharacterHref("Spells", "fireball")).toBeNull();
  });
});
