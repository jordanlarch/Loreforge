import { describe, expect, it } from "vitest";

import {
  DEFAULT_PACING,
  pacingStorageKey,
  parsePacingPrefs,
  turnTimerTone,
} from "./live-pacing";

describe("pacingStorageKey", () => {
  it("scopes per campaign and falls back to sandbox", () => {
    expect(pacingStorageKey("abc")).toBe("loreforge:pacing:abc");
    expect(pacingStorageKey(undefined)).toBe("loreforge:pacing:sandbox");
  });
});

describe("parsePacingPrefs", () => {
  it("defaults on null or malformed JSON", () => {
    expect(parsePacingPrefs(null)).toEqual(DEFAULT_PACING);
    expect(parsePacingPrefs("{not json")).toEqual(DEFAULT_PACING);
  });

  it("accepts valid stored prefs", () => {
    expect(
      parsePacingPrefs(JSON.stringify({ style: "cinematic", turnLimitSec: 60 })),
    ).toEqual({ style: "cinematic", turnLimitSec: 60 });
  });

  it("rejects out-of-range fields", () => {
    expect(
      parsePacingPrefs(JSON.stringify({ style: "frantic", turnLimitSec: 17 })),
    ).toEqual(DEFAULT_PACING);
  });
});

describe("turnTimerTone", () => {
  it("is always ok when no limit is set", () => {
    expect(turnTimerTone(999, 0)).toBe("ok");
  });

  it("escalates ok → warn → over across the limit", () => {
    expect(turnTimerTone(10, 60)).toBe("ok");
    expect(turnTimerTone(45, 60)).toBe("warn");
    expect(turnTimerTone(60, 60)).toBe("over");
    expect(turnTimerTone(75, 60)).toBe("over");
  });
});
