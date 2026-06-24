import { describe, expect, it } from "vitest";

import { TUTORIAL_SCENE2_BEATS } from "@app/engine";

import { tutorialLilyHookOfferedInChat } from "./tutorial-hook";

const lilyText = TUTORIAL_SCENE2_BEATS.find((b) => b.topic === "lily")!.text;

describe("tutorialLilyHookOfferedInChat", () => {
  it("returns true when Lily's hook beat is in GM chat", () => {
    expect(
      tutorialLilyHookOfferedInChat([
        { kind: "gm", text: lilyText },
      ]),
    ).toBe(true);
  });

  it("returns false before Lily speaks", () => {
    expect(
      tutorialLilyHookOfferedInChat([
        { kind: "gm", text: "Barnaby sets down the mug." },
        { kind: "player", text: "I talk to Lily" },
      ]),
    ).toBe(false);
  });
});
