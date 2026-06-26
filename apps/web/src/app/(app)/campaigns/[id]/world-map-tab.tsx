"use client";

import Link from "next/link";

import { OverworldMapShell } from "./overworld-grid";

/**
 * Map tab (CAMP-7 / CAMP-UX UX-3): prep-shell overworld grid editor.
 */
export function WorldMapTab({ campaignId }: { campaignId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Map</h2>
          <p className="mt-1 text-sm text-lore-muted">
            Paint region and settlement territories on the campaign overworld grid.
            Place POI pins for buildings, dungeons, and NPCs.
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}?tab=locations`}
          className="text-sm text-lore-accent underline"
        >
          Manage in Locations →
        </Link>
      </div>
      <OverworldMapShell campaignId={campaignId} mode="edit" />
    </div>
  );
}
