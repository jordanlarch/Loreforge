import { describe, expect, it } from "vitest";

import {
  clampZoom,
  panForSvgZoom,
  scrollForZoom,
  TACTICAL_ZOOM_MAX,
  TACTICAL_ZOOM_MIN,
} from "./map-viewport-zoom";

describe("clampZoom", () => {
  it("clamps below the minimum and above the maximum", () => {
    expect(clampZoom(0.1, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(0.6);
    expect(clampZoom(5, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(1.6);
  });

  it("passes through in-range values", () => {
    expect(clampZoom(1, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(1);
    expect(clampZoom(1.2, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(1.2);
  });

  it("rounds away floating-point step drift", () => {
    expect(clampZoom(0.6 + 0.2 + 0.2, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX)).toBe(
      1,
    );
  });
});

describe("scrollForZoom", () => {
  it("keeps the point under the cursor fixed when zooming in", () => {
    const before = scrollForZoom({
      scrollLeft: 40,
      scrollTop: 20,
      clientX: 120,
      clientY: 80,
      rect: { left: 100, top: 50 },
      oldZoom: 1,
      newZoom: 1.2,
    });
    expect(before.scrollLeft).toBeCloseTo(52);
    expect(before.scrollTop).toBeCloseTo(30);
  });

  it("is a no-op when zoom is unchanged", () => {
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

describe("panForSvgZoom", () => {
  it("adjusts pan so the cursor anchor stays fixed", () => {
    const next = panForSvgZoom({
      panX: 24,
      panY: 24,
      clientX: 200,
      clientY: 150,
      rect: { left: 100, top: 50 },
      oldZoom: 1,
      newZoom: 1.5,
    });
    const gridX = (200 - 100 - 24) / 1;
    expect(next.panX).toBeCloseTo(200 - 100 - gridX * 1.5);
  });
});
