"use client";

import { OverworldMapShell } from "./overworld-grid";

type WorldMapCanvasProps = {
  campaignId: string;
  /** Fill parent height (play shell map zone). */
  fill?: boolean;
  /** Campaign owner can peek hidden stubs (Grill #9). */
  isOwner?: boolean;
  /** In play: travel to a location instead of opening Realms. */
  onEnterLocation?: (entityId: string) => void;
};

/**
 * Embeddable strategic world map (CAMP-UX UX-3). Used in the play shell **World**
 * map tab — read-only overworld grid with discovery fog.
 */
export function WorldMapCanvas({
  campaignId,
  fill = false,
  isOwner = true,
  onEnterLocation,
}: WorldMapCanvasProps) {
  return (
    <OverworldMapShell
      campaignId={campaignId}
      mode="view"
      fill={fill}
      isOwner={isOwner}
      onEnterLocation={onEnterLocation}
    />
  );
}
