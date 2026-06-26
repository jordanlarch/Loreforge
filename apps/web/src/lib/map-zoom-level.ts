/**
 * Map hierarchy labels (CAMP-UX UX-7 / PLAY-7).
 *
 * Full L0→L4 scroll navigation between distinct map geometries is deferred;
 * v1 uses **Current | World** tabs. This module drives level badges and the
 * "Return to scene" affordance on the tactical viewport.
 */
export type MapZoomLevel = 0 | 1 | 2 | 3 | 4;

export const MAP_LEVEL_LABEL: Record<MapZoomLevel, string> = {
  0: "Campaign world",
  1: "Region",
  2: "Settlement",
  3: "Interior",
  4: "Tactical",
};

/** Short badge text shown in map chrome (e.g. "L3"). */
export function mapLevelBadge(level: MapZoomLevel): string {
  return `L${level}`;
}

/**
 * Native depth for the **Current** tab. L1/L2 distinct maps are not rendered
 * yet — exploration scenes report L3; active encounters report L4.
 */
export function resolveCurrentMapLevel(inCombat: boolean): MapZoomLevel {
  return inCombat ? 4 : 3;
}
