import { describe, expect, it } from "vitest";

import {
  DEFAULT_OVERWORLD_MILES_PER_CELL,
  formatMapScale,
  formatOverworldScaleLabel,
  resolveOverworldMilesPerCell,
  resolveStubMapScale,
} from "./map-scale";

describe("resolveOverworldMilesPerCell", () => {
  it("uses configured value when present", () => {
    expect(resolveOverworldMilesPerCell({ width: 10, height: 10, milesPerCell: 1 })).toBe(
      1,
    );
  });

  it("falls back to kingdom default", () => {
    expect(resolveOverworldMilesPerCell({ width: 10, height: 10 })).toBe(
      DEFAULT_OVERWORLD_MILES_PER_CELL,
    );
  });
});

describe("formatMapScale", () => {
  it("formats miles and feet", () => {
    expect(formatMapScale({ distancePerCell: 6, unit: "mi" })).toBe("6 mi/cell");
    expect(formatMapScale({ distancePerCell: 5, unit: "ft" })).toBe("5 ft/cell");
  });
});

describe("formatOverworldScaleLabel", () => {
  it("formats overworld label", () => {
    expect(formatOverworldScaleLabel(60)).toBe("60 mi/cell");
  });
});

describe("resolveStubMapScale", () => {
  it("prefers authored stub scale", () => {
    expect(
      resolveStubMapScale("region", {
        mapScale: { distancePerCell: 10, unit: "mi" },
      }),
    ).toEqual({ distancePerCell: 10, unit: "mi" });
  });

  it("falls back to type defaults for region and settlement", () => {
    expect(resolveStubMapScale("region", {})).toEqual({
      distancePerCell: 6,
      unit: "mi",
    });
    expect(resolveStubMapScale("settlement", {})).toEqual({
      distancePerCell: 500,
      unit: "ft",
    });
  });

  it("returns undefined for interior stubs (engine uses 5 ft squares)", () => {
    expect(resolveStubMapScale("tavern", {})).toBeUndefined();
    expect(
      resolveStubMapScale("tavern", {
        mapScale: { distancePerCell: 5, unit: "ft" },
      }),
    ).toBeUndefined();
  });
});
