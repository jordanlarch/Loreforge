import { describe, expect, it } from "vitest";

import { namesReferencedInNarration } from "./world-reveal.js";

const world = [
  { entityId: "e1", name: "Salt Way", discovered: false },
  { entityId: "e2", name: "Salt", discovered: false },
  { entityId: "e3", name: "Old Mill", discovered: true },
];

describe("namesReferencedInNarration", () => {
  it("matches explicit mentions case-insensitively", () => {
    expect(
      namesReferencedInNarration("You see the road.", ["salt way"], world),
    ).toEqual(["e1"]);
  });

  it("finds names embedded in narration with word boundaries", () => {
    expect(
      namesReferencedInNarration(
        "The party reaches the Salt Way as dusk falls.",
        [],
        world,
      ),
    ).toEqual(["e1"]);
  });

  it("prefers longer names and skips already-discovered entities", () => {
    expect(
      namesReferencedInNarration("The Old Mill creaks.", [], world),
    ).toEqual([]);
  });

  it("does not substring-match inside longer tokens", () => {
    expect(
      namesReferencedInNarration("Assaultway is dangerous.", [], world),
    ).toEqual([]);
  });
});
