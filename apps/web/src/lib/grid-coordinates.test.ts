import { describe, expect, it } from "vitest";

import {
  columnLabel,
  formatOverworldCoordinate,
  formatTacticalCoordinate,
} from "./grid-coordinates";

describe("columnLabel", () => {
  it("maps indices to spreadsheet-style letters", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(25)).toBe("Z");
    expect(columnLabel(26)).toBe("AA");
  });
});

describe("formatTacticalCoordinate", () => {
  it("formats 1-indexed rows", () => {
    expect(formatTacticalCoordinate({ x: 2, y: 3 })).toBe("C4");
  });
});

describe("formatOverworldCoordinate", () => {
  it("formats col/row pairs", () => {
    expect(formatOverworldCoordinate(12, 8)).toBe("(12, 8)");
  });
});
