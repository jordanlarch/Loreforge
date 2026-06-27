import { describe, expect, it } from "vitest";

import { masteryFromOpen5eItemRaw } from "./weapon-mastery-open5e";

describe("masteryFromOpen5eItemRaw", () => {
  it("reads Mastery property from weapon JSON", () => {
    const mastery = masteryFromOpen5eItemRaw({
      weapon: {
        properties: [
          {
            property: {
              name: "Sap",
              type: "Mastery",
              desc: "Disadvantage on next attack.",
            },
          },
        ],
      },
    });
    expect(mastery).toEqual({
      property: "Sap",
      description: "Disadvantage on next attack.",
    });
  });
});
