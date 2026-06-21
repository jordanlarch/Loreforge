import { describe, expect, it } from "vitest";

import {
  DEFAULT_INPUT_MODE,
  INPUT_MODES,
  classifyComposerInput,
  modeLabel,
} from "./live-chat";

describe("INPUT_MODES", () => {
  it("exposes the six play input modes with a valid default", () => {
    expect(INPUT_MODES.map((m) => m.id)).toEqual([
      "speak",
      "action",
      "check",
      "cast",
      "attack",
      "use_item",
    ]);
    expect(INPUT_MODES.some((m) => m.id === DEFAULT_INPUT_MODE)).toBe(true);
  });

  it("maps a mode id to its label", () => {
    expect(modeLabel("attack")).toBe("Attack");
    expect(modeLabel(undefined)).toBeUndefined();
    expect(modeLabel("bogus")).toBeUndefined();
  });
});

describe("classifyComposerInput", () => {
  it("flags empty input", () => {
    expect(classifyComposerInput("   ")).toEqual({ kind: "empty" });
  });

  it("detects slash commands and lowercases the verb", () => {
    expect(classifyComposerInput("/Roll 1d20")).toEqual({
      kind: "slash",
      command: "roll",
    });
  });

  it("detects out-of-character double parens", () => {
    expect(classifyComposerInput("((brb))")).toEqual({ kind: "ooc" });
    expect(classifyComposerInput("(())")).toEqual({ kind: "message" });
  });

  it("treats normal prose as a message", () => {
    expect(classifyComposerInput("I greet the guard.")).toEqual({
      kind: "message",
    });
  });
});
