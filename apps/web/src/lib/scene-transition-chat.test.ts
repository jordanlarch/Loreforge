import { describe, expect, it } from "vitest";

import type { ChatEntry } from "@/lib/live-chat";

import {
  formatSceneDividerLabel,
  isCombatEnd,
  isCombatStart,
  mergeChatEntries,
  sceneSubtitle,
} from "./scene-transition-chat";

describe("sceneSubtitle", () => {
  it("returns the first line, truncated when long", () => {
    expect(sceneSubtitle("A quiet glade.\nMore text.")).toBe("A quiet glade.");
    expect(sceneSubtitle("x".repeat(90))?.length).toBe(78);
  });

  it("returns undefined for empty input", () => {
    expect(sceneSubtitle(undefined)).toBeUndefined();
    expect(sceneSubtitle("  ")).toBeUndefined();
  });
});

describe("formatSceneDividerLabel", () => {
  it("includes subtitle when provided", () => {
    expect(formatSceneDividerLabel("The Woods", "Late evening")).toBe(
      "📍 The Woods · Late evening",
    );
  });
});

describe("mergeChatEntries", () => {
  it("sorts local dividers into the server timeline", () => {
    const server: ChatEntry[] = [
      {
        id: "a",
        kind: "gm",
        author: "GM",
        text: "Hello",
        ts: 100,
      },
      {
        id: "c",
        kind: "player",
        author: "You",
        text: "Later",
        ts: 300,
      },
    ];
    const local: ChatEntry[] = [
      {
        id: "b",
        kind: "scene_divider",
        author: "",
        text: "📍 Woods",
        ts: 200,
      },
    ];
    expect(mergeChatEntries(server, local).map((e) => e.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("combat transition helpers", () => {
  it("detects combat start and end edges", () => {
    expect(isCombatStart(false, true)).toBe(true);
    expect(isCombatStart(true, true)).toBe(false);
    expect(isCombatEnd(true, false)).toBe(true);
    expect(isCombatEnd(false, false)).toBe(false);
  });
});
