import { describe, expect, it } from "vitest";

import {
  computeSessionStats,
  filterTranscriptMessages,
  formatSessionDuration,
  hooksTouchedInSession,
  recapDisplay,
  isRecapPending,
  sessionMessageCount,
} from "./sessions";

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

describe("formatSessionDuration", () => {
  it("formats hours and minutes", () => {
    expect(
      formatSessionDuration(
        "2026-06-25T10:00:00Z",
        "2026-06-25T13:14:00Z",
      ),
    ).toBe("3h 14m");
  });

  it("handles sub-minute sessions", () => {
    expect(
      formatSessionDuration(
        "2026-06-25T10:00:00Z",
        "2026-06-25T10:00:30Z",
      ),
    ).toBe("<1m");
  });
});

describe("computeSessionStats", () => {
  it("aggregates message kinds", () => {
    const stats = computeSessionStats([
      { kind: "gm", author: "GM", text: "Welcome." },
      { kind: "player", author: "Legolas", text: "Hello." },
      { kind: "roll", author: "Engine", text: "Attack roll" },
      { kind: "event", author: "Engine", text: "Thorin casts fireball" },
    ]);
    expect(stats.messages).toBe(4);
    expect(stats.narrative).toBe(2);
    expect(stats.rolls).toBe(1);
    expect(stats.events).toBe(1);
    expect(stats.spells).toBe(1);
  });
});

describe("filterTranscriptMessages", () => {
  const rows = [
    { kind: "gm", author: "GM", text: "A" },
    { kind: "player", author: "PC", text: "B" },
    { kind: "roll", author: "Engine", text: "C" },
  ];

  it("filters by kind", () => {
    expect(filterTranscriptMessages(rows, "gm")).toHaveLength(1);
    expect(filterTranscriptMessages(rows, "all")).toHaveLength(3);
  });
});

describe("hooksTouchedInSession", () => {
  it("returns hooks created or updated in the session window", () => {
    const hooks = [
      {
        id: "1",
        title: "Old",
        status: "open",
        createdAt: "2026-06-20T12:00:00Z",
        updatedAt: "2026-06-20T12:00:00Z",
      },
      {
        id: "2",
        title: "Touched",
        status: "active",
        createdAt: "2026-06-24T12:00:00Z",
        updatedAt: "2026-06-25T11:00:00Z",
      },
    ];
    expect(
      hooksTouchedInSession(
        hooks,
        "2026-06-25T10:00:00Z",
        "2026-06-25T12:00:00Z",
      ).map((h) => h.id),
    ).toEqual(["2"]);
  });
});
