import { describe, expect, it, vi, afterEach } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats recent times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T12:00:00Z"));

    expect(formatRelativeTime(new Date("2026-06-26T11:59:30Z"))).toBe("just now");
    expect(formatRelativeTime(new Date("2026-06-26T11:55:00Z"))).toBe("5m ago");
    expect(formatRelativeTime(new Date("2026-06-26T10:00:00Z"))).toBe("2h ago");
    expect(formatRelativeTime(new Date("2026-06-24T12:00:00Z"))).toBe("2d ago");
  });
});
