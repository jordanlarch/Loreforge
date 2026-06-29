import { describe, expect, it } from "vitest";

import { smithyItemLibraryCategory } from "./smithy-categories";

describe("smithy-categories", () => {
  it("maps copiedFromSlug prefixes to library categories", () => {
    expect(
      smithyItemLibraryCategory({ copiedFromSlug: "Species:hill-dwarf" }),
    ).toBe("Species");
    expect(
      smithyItemLibraryCategory({ copiedFromSlug: "Feats:srd-2024_alert" }),
    ).toBe("Feats");
    expect(
      smithyItemLibraryCategory({ copiedFromSlug: "Advanced:srd_traps_pits" }),
    ).toBeNull();
    expect(smithyItemLibraryCategory({ copiedFromSlug: "longsword" })).toBe(
      "Items",
    );
    expect(smithyItemLibraryCategory({ copiedFromSlug: null })).toBe("Items");
    expect(
      smithyItemLibraryCategory({ copiedFromSlug: "Rules:srd_combat_foo" }),
    ).toBeNull();
  });
});
