import { describe, expect, it } from "vitest";

import { parseSmithyCopyKey } from "@/server/lib/copy-codex-to-smithy";

describe("parseSmithyCopyKey", () => {
  it("parses plain item slugs as Items", () => {
    expect(parseSmithyCopyKey("longsword")).toEqual({
      category: "Items",
      slug: "longsword",
    });
  });

  it("parses category-prefixed snapshot keys", () => {
    expect(parseSmithyCopyKey("Species:hill-dwarf")).toEqual({
      category: "Species",
      slug: "hill-dwarf",
    });
  });
});
