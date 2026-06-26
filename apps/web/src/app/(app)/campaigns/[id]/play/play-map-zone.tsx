"use client";

import type { ReactNode } from "react";

import type { PlayMapTab } from "@/lib/play-shell";

/**
 * Center map chrome: **Current | World** tabs + optional party chips (CAMP-UX UX-1).
 */
export function PlayMapZone({
  mapTab,
  onMapTabChange,
  partyChips,
  currentMap,
  worldMap,
}: {
  mapTab: PlayMapTab;
  onMapTabChange: (tab: PlayMapTab) => void;
  partyChips?: ReactNode;
  currentMap: ReactNode;
  worldMap: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <div
          role="tablist"
          aria-label="Map view"
          className="inline-flex rounded-md border border-lore-border p-0.5"
        >
          {(["current", "world"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mapTab === tab}
              onClick={() => onMapTabChange(tab)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                mapTab === tab
                  ? "bg-lore-accent-dim text-lore-text"
                  : "text-lore-muted hover:text-lore-text"
              }`}
            >
              {tab === "current" ? "Current" : "World"}
            </button>
          ))}
        </div>
        {partyChips ? (
          <div className="min-w-0 flex-1 overflow-x-auto">{partyChips}</div>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {mapTab === "current" ? currentMap : worldMap}
      </div>
    </div>
  );
}
