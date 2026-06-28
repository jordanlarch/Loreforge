import { describe, expect, it } from "vitest";

import { isValidTrapDefinition } from "./hazard-definitions";

describe("hazard-definitions re-exports", () => {
  it("re-exports trap validation from toolbox-definitions", () => {
    expect(
      isValidTrapDefinition({
        id: "poison-needle",
        name: "Poison Needle",
        kind: "trap",
        description: "Needle trap.",
        trigger: "Touch.",
        effect: { damage: [{ dice: "1d8", type: "poison" }] },
        reset: "once",
      }),
    ).toBe(true);
  });
});
