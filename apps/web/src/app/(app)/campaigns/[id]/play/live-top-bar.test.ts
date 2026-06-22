import { describe, expect, it } from "vitest";

import { formatDuration } from "./live-top-bar";

describe("formatDuration", () => {
  it("formats sub-hour durations as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(599)).toBe("9:59");
  });

  it("formats hour-plus durations as h:mm:ss", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("floors fractional seconds and clamps negatives to zero", () => {
    expect(formatDuration(9.9)).toBe("0:09");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
