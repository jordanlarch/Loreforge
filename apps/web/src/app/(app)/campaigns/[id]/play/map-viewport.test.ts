import { describe, expect, it } from "vitest";

import {
  clampZoom,
  scrollForZoom,
  TACTICAL_ZOOM_MAX,
  TACTICAL_ZOOM_MIN,
} from "@/lib/map-viewport-zoom";

describe("map-viewport re-exports", () => {
  it("uses shared tactical zoom bounds", () => {
    expect(clampZoom(0.1, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(0.6);
    expect(
      scrollForZoom({
        scrollLeft: 10,
        scrollTop: 5,
        clientX: 0,
        clientY: 0,
        rect: { left: 0, top: 0 },
        oldZoom: 1,
        newZoom: 1,
      }),
    ).toEqual({ scrollLeft: 10, scrollTop: 5 });
  });
});
