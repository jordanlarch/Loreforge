import { describe, expect, it } from "vitest";

import { edgesWithin } from "./campaign-world";

describe("edgesWithin", () => {
  const edges = [
    { id: "e1", fromId: "a", toId: "b" },
    { id: "e2", fromId: "b", toId: "c" },
    { id: "e3", fromId: "c", toId: "d" },
    { id: "e4", fromId: "a", toId: "z" },
  ];

  it("keeps only edges with both endpoints in the node set", () => {
    const kept = edgesWithin(edges, ["a", "b", "c"]);
    expect(kept.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("accepts a Set and preserves order", () => {
    const kept = edgesWithin(edges, new Set(["a", "b", "c", "d"]));
    expect(kept.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("returns nothing when the set excludes all endpoints", () => {
    expect(edgesWithin(edges, ["x", "y"])).toEqual([]);
  });
});
