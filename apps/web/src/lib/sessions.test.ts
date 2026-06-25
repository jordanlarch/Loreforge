import { describe, expect, it } from "vitest";

import { recapDisplay, isRecapPending, sessionMessageCount } from "./sessions";

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

  it("shows a generating state while async recap is pending", () => {
    expect(recapDisplay("", { pending: true })).toEqual({
      text: "Generating recap…",
      muted: true,
    });
  });
});

describe("isRecapPending", () => {
  it("is true for a fresh session with no recap text", () => {
    const now = Date.parse("2026-06-25T12:00:00Z");
    expect(isRecapPending("", "2026-06-25T11:59:00Z", now)).toBe(true);
  });

  it("is false once recap text lands", () => {
    expect(isRecapPending("The ogre fell.", "2026-06-25T11:59:00Z")).toBe(false);
  });

  it("stops pending after the poll window", () => {
    const now = Date.parse("2026-06-25T13:00:00Z");
    expect(isRecapPending("", "2026-06-25T11:59:00Z", now)).toBe(false);
  });
});
