"use client";

import Link from "next/link";

import { WorldMapCanvas } from "./world-map-canvas";

/**
 * Map tab (CAMP-7 / CAMP-UX UX-2): prep-shell strategic canvas — embeds {@link WorldMapCanvas}.
 */
export function WorldMapTab({ campaignId }: { campaignId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Map</h2>
          <p className="mt-1 text-sm text-lore-muted">
            Strategic view of campaign locations. Drag to pan.
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}?tab=locations`}
          className="text-sm text-lore-accent underline"
        >
          Manage in Locations →
        </Link>
      </div>
      <WorldMapCanvas campaignId={campaignId} />
    </div>
  );
}
