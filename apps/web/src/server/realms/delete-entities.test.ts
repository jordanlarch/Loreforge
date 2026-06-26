import { describe, expect, it } from "vitest";

import { campaignExclusiveEntityIds } from "./delete-entities";

describe("campaignExclusiveEntityIds", () => {
  it("returns ids only linked to the deleted campaign", () => {
    expect(
      campaignExclusiveEntityIds(
        ["a", "b", "c"],
        ["b"],
      ),
    ).toEqual(["a", "c"]);
  });

  it("returns empty when every entity is shared", () => {
    expect(campaignExclusiveEntityIds(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("returns all when none are shared", () => {
    expect(campaignExclusiveEntityIds(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
