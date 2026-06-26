import type { MapScale, OverworldGridConfig } from "@app/db";

/** DMG kingdom-scale default (6 miles per overworld cell). */
export const DEFAULT_OVERWORLD_MILES_PER_CELL = 6;

/** Suggested L0 presets from the DMG mapping scales. */
export const OVERWORLD_SCALE_PRESETS = [
  { label: "Province (1 mi/cell)", milesPerCell: 1 },
  { label: "Kingdom (6 mi/cell)", milesPerCell: 6 },
  { label: "Continent (60 mi/cell)", milesPerCell: 60 },
] as const;

/** Region and settlement stubs may override local map scale; interiors use engine 5 ft. */
export function stubSupportsConfigurableMapScale(type: string): boolean {
  return type === "region" || type === "settlement";
}

export function resolveOverworldMilesPerCell(
  grid: OverworldGridConfig | null | undefined,
): number {
  const value = grid?.milesPerCell;
  if (typeof value === "number" && value > 0) return value;
  return DEFAULT_OVERWORLD_MILES_PER_CELL;
}

export function formatMapScale(scale: MapScale): string {
  const unit =
    scale.unit === "mi" ? "mi" : scale.unit === "km" ? "km" : "ft";
  return `${scale.distancePerCell} ${unit}/cell`;
}

export function formatOverworldScaleLabel(milesPerCell: number): string {
  return `${milesPerCell} mi/cell`;
}

/** Default local-map scale when none is authored (region/settlement only). */
export function defaultStubMapScale(type: string): MapScale | undefined {
  if (type === "region") return { distancePerCell: 6, unit: "mi" };
  if (type === "settlement") return { distancePerCell: 500, unit: "ft" };
  return undefined;
}

export function resolveStubMapScale(
  type: string,
  layer: { mapScale?: MapScale | null } | null | undefined,
): MapScale | undefined {
  if (!stubSupportsConfigurableMapScale(type)) return undefined;
  if (layer?.mapScale && layer.mapScale.distancePerCell > 0) {
    return layer.mapScale;
  }
  return defaultStubMapScale(type);
}
