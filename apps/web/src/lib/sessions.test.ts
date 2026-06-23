import { describe, expect, it } from "vitest";

import { recapDisplay, sessionMessageCount } from "./sessions";

describe("sessionMessageCount", () => {
  it("counts the [startSeq, endSeq) span", () => {
    expect(sessionMessageCount(0, 12)).toBe(12);
    expect(sessionMessageCount(12, 30)).toBe(18);
  });

  it("never goes negative", () => {
    expect(sessionMessageCount(10, 5)).toBe(0);
    expect(sessionMessageCount(7, 7)).toBe(0);
  });
});

describe("recapDisplay", () => {
  it("returns the recap text when present", () => {
    expect(recapDisplay("The party stormed the keep.")).toEqual({
      text: "The party stormed the keep.",
      muted: false,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(recapDisplay("  Onward.  ")).toEqual({ text: "Onward.", muted: false });
  });

  it("falls back to a muted placeholder when empty", () => {
    const blank = recapDisplay("   ");
    expect(blank.muted).toBe(true);
    expect(blank.text.length).toBeGreaterThan(0);
  });
});
