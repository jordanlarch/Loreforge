import { describe, expect, it } from "vitest";

import { weaponPropertyEntries } from "./codex-item-display";

describe("codex-item-display", () => {
  it("extracts weapon property names, descriptions, and details", () => {
    const entries = weaponPropertyEntries({
      weapon: {
        properties: [
          {
            property: {
              name: "Sap",
              type: "Mastery",
              desc: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
            },
            detail: null,
          },
          {
            property: {
              name: "Versatile",
              desc: "A Versatile weapon can be used with one or two hands.",
            },
            detail: "1d10",
          },
        ],
      },
    });

    expect(entries).toEqual([
      {
        name: "Sap",
        desc: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
        detail: null,
        type: "Mastery",
      },
      {
        name: "Versatile",
        desc: "A Versatile weapon can be used with one or two hands.",
        detail: "1d10",
        type: null,
      },
    ]);
  });
});
