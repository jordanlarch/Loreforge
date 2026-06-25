import { describe, expect, it } from "vitest";

import {
  matchNpcToCascadeLocation,
  type CascadeEntityRef,
} from "./cascade-wiring";

const tavern: CascadeEntityRef = {
  id: "t1",
  name: "The Driftwood Inn",
  summary: "A famous tavern.",
  type: "tavern",
};

const settlement: CascadeEntityRef = {
  id: "s1",
  name: "Willowmere Village",
  summary: "The hamlet proper.",
  type: "settlement",
};

describe("matchNpcToCascadeLocation", () => {
  it("links when the NPC summary names the location", () => {
    expect(
      matchNpcToCascadeLocation(
        {
          name: "Gavin Thorne",
          summary:
            "The jovial barkeep of the Driftwood Inn, known for his stories.",
        },
        [tavern, settlement],
      ),
    ).toEqual(tavern);
  });

  it("links barkeeps to the tavern when the name is not repeated", () => {
    expect(
      matchNpcToCascadeLocation(
        { name: "Marta Tallow", summary: "The gruff barkeep who runs the hearth." },
        [tavern, settlement],
      ),
    ).toEqual(tavern);
  });

  it("links village elders to the settlement", () => {
    expect(
      matchNpcToCascadeLocation(
        {
          name: "Marta Greenhill",
          summary: "The village elder, torn between protecting her people.",
        },
        [tavern, settlement],
      ),
    ).toEqual(settlement);
  });

  it("returns undefined when no location matches", () => {
    expect(
      matchNpcToCascadeLocation(
        { name: "Stranger", summary: "A wandering sellsword." },
        [tavern],
      ),
    ).toBeUndefined();
  });
});
